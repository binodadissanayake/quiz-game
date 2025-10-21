// ==========================================================
//  GLOBAL STATE VARIABLES
// ==========================================================
let questions = []; // Array of all filtered questions (used as reference for index)
let allQuestions = []; // Stores all questions loaded from CSV
let questionQueue = []; // Array used as a Queue for next questions (FIFO)
let currentQuestionIndex = 0;
let score = 0;
let timer;
let timeLeft = 60; // Set initial time to 1 minute (60 seconds)
let questionHistory = []; // Stack for going back to previous questions (LIFO)
let userScores = new Map(); // Hash Table for storing scores (for current session)
let scoreHistory = []; // Array to store past scores (for current session display)
let playerName = ''; // Variable to store the player's name
let selectedCategory = ''; // Variable to store the chosen category
let userAnswers = []; // Array to store the result of each question for the review screen

// ==========================================================
//  LINKED LIST IMPLEMENTATION (for recently answered questions)
// ==========================================================
class ListNode {
    constructor(questionIndex, isCorrect) {
        this.questionIndex = questionIndex;
        this.isCorrect = isCorrect;
        this.next = null;
    }
}

class LinkedList {
    constructor() {
        this.head = null;
        this.tail = null;
    }

    add(questionIndex, isCorrect) {
        const node = new ListNode(questionIndex, isCorrect);
        if (!this.head) {
            this.head = node;
            this.tail = node;
        } else {
            this.tail.next = node;
            this.tail = node;
        }
    }

    display() {
        let current = this.head;
        let output = [];
        while (current) {
            output.push(`Q${current.questionIndex + 1} - ${current.isCorrect ? 'Correct' : 'Wrong'}`);
            current = current.next;
        }
        console.log("LinkedList of answered questions:", output.join(", "));
        return output;
    }

    clear() {
        this.head = null;
        this.tail = null;
    }
}

// Initialize linked list
let answeredQuestionsList = new LinkedList();

// ==========================================================
// UTILITY FUNCTIONS
// ==========================================================
function toRoman(index) {
    const numerals = ['i', 'ii', 'iii', 'iv'];
    return numerals[index];
}
 //bubblesort
function bubbleSort(arr, key = null, descending = false) {
    let n = arr.length;
    let swapped;
    for (let i = 0; i < n - 1; i++) {
        swapped = false;
        for (let j = 0; j < n - 1 - i; j++) {
            const valA = key ? arr[j][key] : arr[j];
            const valB = key ? arr[j + 1][key] : arr[j + 1];
            let condition = descending ? valA < valB : valA > valB;
            if (condition) {
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                swapped = true;
            }
        }
        if (!swapped) break;
    }
    return arr;
}

function loadCSV() {
    Papa.parse("questions.csv", {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: function(result) {
            allQuestions = result.data
                .filter(row => row.question)
                .map(row => ({
                    question: row.question,
                    options: [row.answer1, row.answer2, row.answer3, row.answer4],
                    category: row.category ? String(row.category).trim().toLowerCase() : 'general', 
                    correctAnswer: row.correctAnswer - 1 
                }));
            allQuestions = allQuestions.sort(() => Math.random() - 0.5);
            console.log("All Questions Loaded:", allQuestions.length);
        }
    });
}

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(screen => screen.style.display = "none");
    document.getElementById(screenId).style.display = "block";
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function updateHighScore() {
    const storedHighScore = parseInt(localStorage.getItem('highScore') || '0');
    let currentHighScore = storedHighScore;
    if (score > storedHighScore) {
        currentHighScore = score;
        localStorage.setItem('highScore', score);
    }
    document.getElementById('high-score').textContent = currentHighScore;
}

function addScoreToHistory(newScore) {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let storedHistory = JSON.parse(localStorage.getItem('quizHistory') || '[]');
    storedHistory.push({ name: playerName, score: newScore, date: `${date} ${time}`, category: selectedCategory });
    localStorage.setItem('quizHistory', JSON.stringify(storedHistory));
    updateScoreHistoryDisplay(storedHistory);
}

function updateScoreHistoryDisplay(historyData = null) {
    const scoreHistoryList = document.getElementById("score-history");
    scoreHistoryList.innerHTML = ""; 
    const history = historyData || JSON.parse(localStorage.getItem('quizHistory') || '[]');
    history.sort((a, b) => b.score - a.score)
           .slice(0, 10)
           .forEach((record, index) => {
                const listItem = document.createElement("li");
                const categoryText = record.category ? ` (${record.category.toUpperCase()})` : '';
                listItem.textContent = `#${index + 1} ${record.name}${categoryText}: ${record.score} points`;
                scoreHistoryList.appendChild(listItem);
    });
}

function clearScoreHistory() {
    if (confirm("Are you sure you want to clear ALL saved score history and the High Score? This cannot be undone.")) {
        localStorage.removeItem('quizHistory');
        localStorage.setItem('highScore', '0');
        updateHighScore();
        updateScoreHistoryDisplay([]);
        alert("Score history has been cleared!");
    }
}
//play sound
function playSound(soundFile) {
    const audio = new Audio(`assets/${soundFile}`);
    audio.play().catch(e => console.error("Sound playback error:", e));
}

// ==========================================================
//  AUDIO CONTROLS
// ==========================================================
const gameMusic = document.getElementById("gamemusic-6082");
const muteBtn = document.getElementById("mute-btn");
let isMuted = false;

function playBackgroundMusic() {
    if (!isMuted) gameMusic.play().catch(err => console.log(err));
}

function toggleMute() {
    isMuted = !isMuted;
    gameMusic.muted = isMuted;
    const icon = muteBtn.querySelector('i');
    if (isMuted) {
        gameMusic.pause();
        icon.classList.replace("fa-volume-up","fa-volume-mute");
    } else {
        playBackgroundMusic();
        icon.classList.replace("fa-volume-mute","fa-volume-up");
    }
}

muteBtn.addEventListener("click", toggleMute);

// ==========================================================
//  GAME FLOW FUNCTIONS
// ==========================================================
function proceedToCategory() {
    playerName = document.getElementById("name-input").value.trim();
    if (playerName === '') { alert("Please enter your name."); return; }
    document.getElementById("player-name-display").textContent = playerName;
    if (allQuestions.length === 0) { alert("Questions are still loading."); return; }
    showScreen("category-screen");
}

function startQuiz(category) {
    selectedCategory = category.toLowerCase();
    questions = allQuestions.filter(q => q.category === selectedCategory);
    if (questions.length === 0) { alert(`No questions for '${category}'.`); showScreen("category-screen"); return; }
    questionQueue = questions.slice();
    currentQuestionIndex = 0;
    score = 0;
    timeLeft = 60;
    questionHistory = [];
    userAnswers = [];
    answeredQuestionsList.clear(); // Clear linked list
    document.getElementById("time").style.color = "#ff4444";
    showScreen("quiz-screen");
    loadQuestion();
    startTimer();
    playBackgroundMusic();
    userScores.set(playerName, score);
    updateHighScore();
}

function loadQuestion() {
    if (questions.length === 0) { document.getElementById("question").textContent = "No questions available."; return; }
    const question = questions[currentQuestionIndex];
    document.getElementById("question").textContent = `Q${currentQuestionIndex + 1}: ${question.question}`;
    const buttons = document.querySelectorAll("#answers button");
    question.options.forEach((option,index)=>{
        buttons[index].textContent = `${toRoman(index)}. ${option}`;
        buttons[index].disabled = false;
        buttons[index].classList.remove("correct","wrong");
    });
}
//correct and wrong answer check
function checkAnswer(answerIndex) {
    const question = questions[currentQuestionIndex];
    const correctAnswer = question.correctAnswer;
    const buttons = document.querySelectorAll("#answers button");
    if (buttons[0].disabled) return;
    buttons.forEach((btn,i)=>{btn.disabled=true;if(i===correctAnswer) btn.classList.add("correct"); if(i===answerIndex && i!==correctAnswer) btn.classList.add("wrong");});
    const isCorrect = answerIndex === correctAnswer;
    userAnswers[currentQuestionIndex] = {
        question: question.question,
        userAnswerIndex: answerIndex,
        correctAnswerIndex: correctAnswer,
        options: question.options,
        isCorrect: isCorrect
    };
    if(isCorrect){score++;playSound("correct-156911.mp3");}else{playSound("wrong-answer-129254.mp3");}
    userScores.set(playerName, score);
    answeredQuestionsList.add(currentQuestionIndex,isCorrect);
    answeredQuestionsList.display();
}
//stack for previous questions and queue for next questions
function nextQuestion() {
    const isAnswered = document.querySelector("#answers button").disabled;
    if (!isAnswered){alert("Select an answer first."); return;}
    if(questionQueue.length>0){
        questionHistory.push(currentQuestionIndex);
        questionQueue.shift();
        currentQuestionIndex++;
        loadQuestion();
    }else{
        clearInterval(timer);
        gameMusic.pause();
        showReviewScreen();
    }
}
//stack for previous questions
function goBack(){
    if(questionHistory.length>0){
        currentQuestionIndex = questionHistory.pop();
        questionQueue.unshift(questions[currentQuestionIndex]);
        loadQuestion();
    }
}

function startTimer(){
    clearInterval(timer);
    document.getElementById("time").textContent = formatTime(timeLeft);
    timer = setInterval(()=>{
        timeLeft--;
        if(timeLeft<=0){clearInterval(timer);gameMusic.pause();showReviewScreen(true);return;}
        document.getElementById("time").textContent = formatTime(timeLeft);
        document.getElementById("time").style.color = timeLeft<=10?"red":"#ff4444";
    },1000);
}
//review screen
function showReviewScreen(timeExpired=false){
    const reviewList = document.getElementById("review-list");
    reviewList.innerHTML="";
    document.getElementById("review-title").textContent = timeExpired?"Time's Up! Review Your Answers":"Quiz Complete! Review Your Answers";
    questions.forEach((question,index)=>{
        const result = userAnswers[index];
        const li = document.createElement("li");
        let statusText='Skipped',statusClass='skipped-review';
        if(result){statusText=result.isCorrect?'Correct':'Wrong';statusClass=result.isCorrect?'correct-review':'wrong-review';}
        let content=`<div class="review-question-header ${statusClass}"><span class="review-status">${statusText}</span><span class="review-q-number">Q${index+1}: </span><span class="review-q-text">${question.question}</span></div>`;
        if(result){
            const userAnswer=result.options[result.userAnswerIndex];
            const correctAnswer=result.options[result.correctAnswerIndex];
            content+=`<div class="review-answers"><p><strong>Your Answer:</strong> <span class="${result.isCorrect?'correct-text':'wrong-text'}">${toRoman(result.userAnswerIndex)}. ${userAnswer}</span></p>${result.isCorrect?'':`<p><strong>Correct Answer:</strong> <span class="correct-text">${toRoman(result.correctAnswerIndex)}. ${correctAnswer}</span></p>`}</div>`;
        }else{content+=`<div class="review-answers"><p><em>You did not answer this question.</em></p></div>`;}
        li.innerHTML=content;
        reviewList.appendChild(li);
    });
    document.getElementById("review-score-display").textContent=score;
    showScreen("review-screen");
}

function proceedToScoreboard(){
    document.getElementById("final-score").textContent=score;
    document.getElementById("game-over-score").textContent=score;
    addScoreToHistory(score);
    updateHighScore();
    showScreen("scoreboard-screen");
}
//restart
function restartGame(){
    currentQuestionIndex=0;
    score=0;
    timeLeft=60;
    questions=[];
    questionQueue=[];
    selectedCategory='';
    questionHistory=[];
    userAnswers=[];
    answeredQuestionsList.clear();
    document.getElementById("name-input").value=playerName;
    clearInterval(timer);
    gameMusic.pause();
    showScreen("home-screen");
}

function goHome(){restartGame();}

// ==========================================================
// INITIALIZATION
// ==========================================================
window.onload=function(){
    loadCSV();
    updateHighScore();
    updateScoreHistoryDisplay();
    showScreen("home-screen");
    gameMusic.pause();
    gameMusic.muted=false;
};
