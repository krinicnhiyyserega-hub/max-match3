const width = 8;
const candyColors = ['color-0', 'color-1', 'color-2', 'color-3', 'color-4'];
const grid = document.getElementById('grid');
let board = [];
let score = 0;
let moves = 30;
let comboMultiplier = 1; 
let matchesFoundInTurn = false;
let gameInterval = null;

const scoreDisplay = document.getElementById('score');
const comboDisplay = document.getElementById('combo');
const movesDisplay = document.getElementById('moves');
const modal = document.getElementById('game-over-modal');
const wheelModal = document.getElementById('wheel-modal');
const finalScoreDisplay = document.getElementById('final-score');
const wheel = document.getElementById('wheel');

let firstClickCell = null;
let isRefilling = false;
let flashActive = false; 

// Переменные для отслеживания свайпов
let touchStartX = 0;
let touchStartY = 0;
let touchIdBeingDragged = null;

// --- ДВИЖОК НАСТОЯЩЕГО ОГНЯ (CANVAS) ---
const canvas = document.getElementById('fireCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let fireActive = false; 

function resizeCanvas() {
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + Math.random() * 20;
        this.speedX = (Math.random() - 0.5) * 3;
        this.speedY = -Math.random() * 4 - 2;
        this.radius = Math.random() * 15 + 5;
        this.maxLife = Math.random() * 40 + 20;
        this.life = this.maxLife;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life--;
        if (this.radius > 0.3) this.radius -= 0.2;
    }
    draw() {
        let ratio = this.life / this.maxLife;
        let r = 255;
        let g = Math.floor(255 * ratio);
        let b = Math.floor(50 * ratio);
        let alpha = ratio;

        if (ratio < 0.3) {
            ctx.fillStyle = `rgba(100, 100, 100, ${alpha})`;
        } else {
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function handleParticles() {
    let pCount = fireActive ? 8 : 1;
    if (flashActive) pCount = 25; 
    
    for (let i = 0; i < pCount; i++) {
        particles.push(new Particle());
    }

    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        
        if (flashActive) {
            ctx.fillStyle = `hsl(${Math.random() * 360}, 100%, 60%)`;
        } else {
            particles[i].draw();
            continue;
        }

        ctx.beginPath();
        let xPos = flashActive ? Math.random() * canvas.width : particles[i].x;
        let yPos = flashActive ? Math.random() * canvas.height : particles[i].y;
        ctx.arc(xPos, yPos, particles[i].radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

function animateFire() {
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        handleParticles();
    }
    requestAnimationFrame(animateFire);
}
animateFire();

// --- СИНТЕЗАТОР ЗВУКОВЫХ ЭФФЕКТОВ ---
function playExplosionSound() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'triangle';
    
    const now = audioCtx.currentTime;
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    
    oscillator.start(now);
    oscillator.stop(now + 0.25);
}

// --- СОЗДАНИЕ ИГРОВОГО ПОЛЯ ---
function createBoard() {
    if (gameInterval) clearInterval(gameInterval);
    grid.innerHTML = '';
    board = [];
    
    score = 0;
    moves = 30;
    comboMultiplier = 1;
    scoreDisplay.innerHTML = score;
    movesDisplay.innerHTML = moves;
    comboDisplay.innerHTML = 'x1';
    modal.classList.add('hidden');
    grid.classList.remove('fire-mode');
    fireActive = false;

    for (let i = 0; i < width * width; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.setAttribute('id', i);
        let randomColor = Math.floor(Math.random() * candyColors.length);
        cell.classList.add(candyColors[randomColor]);
        grid.appendChild(cell);
        board.push(cell);

                // // Управление свайпами и нажатиями
        cell.addEventListener('touchstart', function(e) {
            if (isRefilling || moves <= 0) return;
            touchIdBeingDragged = parseInt(this.id);
            touchStartX = e.touches.clientX;
            touchStartY = e.touches.clientY;
        }, { passive: true });

        cell.addEventListener('touchmove', function(e) {
            if (isRefilling || moves <= 0 || touchIdBeingDragged === null) return;

            let currentX = e.touches.clientX;
            let currentY = e.touches.clientY;
            let diffX = currentX - touchStartX;
            let diffY = currentY - touchStartY;
            const swipeThreshold = 30; 
            let targetId = null;

            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (Math.abs(diffX) > swipeThreshold) {
                    if (diffX > 0 && touchIdBeingDragged % width < width - 1) targetId = touchIdBeingDragged + 1;
                    else if (diffX < 0 && touchIdBeingDragged % width > 0) targetId = touchIdBeingDragged - 1;
                }
            } else {
                if (Math.abs(diffY) > swipeThreshold) {
                    if (diffY > 0 && touchIdBeingDragged < width * (width - 1)) targetId = touchIdBeingDragged + width;
                    else if (diffY < 0 && touchIdBeingDragged >= width) targetId = touchIdBeingDragged - width;
                }
            }

            if (targetId !== null) {
                let cellBeingDragged = board[touchIdBeingDragged];
                let cellBeingReplaced = board[targetId];

                let color1 = cellBeingDragged.className;
                let color2 = cellBeingReplaced.className;

                cellBeingDragged.className = color2;
                cellBeingReplaced.className = color1;

                moves--;
                movesDisplay.innerHTML = moves;
                touchIdBeingDragged = null; 
            }
        }, { passive: true });

        cell.addEventListener('touchend', function() {
            touchIdBeingDragged = null;
        }, { passive: true });

        // ДОБАВЛЯЕМ ОБРАБОТКУ КЛИКОВ:
        cell.addEventListener('click', function() {
            if (isRefilling || moves <= 0) return;

            if (!firstClickCell) {
                firstClickCell = this;
                this.style.transform = 'scale(1.15)';
                this.style.filter = 'brightness(1.2)';
            } else {
                let id1 = parseInt(firstClickCell.id);
                let id2 = parseInt(this.id);
                const validMoves = [id1 - 1, id1 + 1, id1 - width, id1 + width];

                firstClickCell.style.transform = '';
                firstClickCell.style.filter = '';

                if (validMoves.includes(id2)) {
                    let color1 = firstClickCell.className;
                    let color2 = this.className;

                    firstClickCell.className = color2;
                    this.className = color1;

                    moves--;
                    movesDisplay.innerHTML = moves;
                    firstClickCell = null;
                } else {
                    firstClickCell = this;
                    this.style.transform = 'scale(1.15)';
                    this.style.filter = 'brightness(1.2)';
                }
            }
        });
    } // Конец цикла for (строка 157 со скриншота переместится сюда)


    gameInterval = setInterval(function(){
        matchesFoundInTurn = false;
        checkMatches();
        moveDown();
        
        if (matchesFoundInTurn) {
            comboMultiplier++;
            comboDisplay.innerHTML = `x${comboMultiplier}`;
            if (comboMultiplier >= 3) {
                grid.classList.add('fire-mode');
                fireActive = true;
            }
        } else if (!isRefilling) {
            comboMultiplier = 1;
            comboDisplay.innerHTML = 'x1';
            grid.classList.remove('fire-mode');
            fireActive = false;
        }

        if (moves <= 0 && !isRefilling) {
            clearInterval(gameInterval);
            endGame();
        }
    }, 150);
}

// --- ПРОВЕРКА ЛИНИЙ И ЭФФЕКТЫ ---
function checkMatches() {
    let playedSoundThisTick = false;
    const container = document.querySelector('.game-container');

    function triggerMegaEffects(colorClass) {
        if (!playedSoundThisTick) {
            playExplosionSound();
            playedSoundThisTick = true;
        }
        if (colorClass === 'color-0') {
            flashActive = true;
            if (container) container.classList.add('screen-shake');
            setTimeout(() => {
                if (container) container.classList.remove('screen-shake');
                flashActive = false;
            }, 400);
        }
    }

    for (let i = 0; i < 62; i++) {
        let rowOfThree = [i, i + 1, i + 2];
        if (i % width < 6 && board[i] && candyColors.find(c => board[i].classList.contains(c))) {
            let colorClass = candyColors.find(c => board[i].classList.contains(c));
            if (rowOfThree.every(index => board[index] && board[index].classList.contains(colorClass))) {
                score += 10 * comboMultiplier;
                scoreDisplay.innerHTML = score;
                matchesFoundInTurn = true;
                triggerMegaEffects(colorClass);
                rowOfThree.forEach(index => {
                    candyColors.forEach(c => board[index].classList.remove(c));
                    board[index].classList.add('blank');
                });
            }
        }
    }
    for (let i = 0; i < 47; i++) {
        let columnOfThree = [i, i + width, i + width * 2];
        if (board[i] && candyColors.find(c => board[i].classList.contains(c))) {
            let colorClass = candyColors.find(c => board[i].classList.contains(c));
            if (columnOfThree.every(index => board[index] && board[index].classList.contains(colorClass))) {
                score += 10 * comboMultiplier;
                scoreDisplay.innerHTML = score;
                matchesFoundInTurn = true;
                triggerMegaEffects(colorClass);
                columnOfThree.forEach(index => {
                    candyColors.forEach(c => board[index].classList.remove(c));
                    board[index].classList.add('blank');
                });
            }
        }
    }
}

// --- ЛОГИКА ПАДЕНИЯ ФИШЕК (ГРАВИТАЦИЯ) ---
function moveDown() {
    let hasMoved = false;
    for (let i = 0; i < 56; i++) {
        if (board[i + width] && board[i + width].classList.contains('blank')) {
            let currentColor = candyColors.find(c => board[i].classList.contains(c));
            if (currentColor) {
                board[i + width].classList.remove('blank');
                board[i + width].classList.add(currentColor);
                board[i].classList.remove(currentColor);
                board[i].classList.add('blank');
                hasMoved = true;
            }
        }
    }
    for (let i = 0; i < width; i++) {
        if (board[i] && board[i].classList.contains('blank')) {
            let randomColor = candyColors[Math.floor(Math.random() * candyColors.length)];
            board[i].classList.remove('blank');
            board[i].classList.add(randomColor);
            hasMoved = true;
        }
    }
    isRefilling = hasMoved;
}

// --- КОНЕЦ ИГРЫ И РЕКЛАМА ЯНДЕКСА ---
function endGame() {
    fireActive = false;
    if (grid) grid.classList.remove('fire-mode');
    
    if (window.yaContextCb && typeof Ya !== 'undefined' && Ya.Context && Ya.Context.AdvManager) {
        window.yaContextCb.push(() => {
            Ya.Context.AdvManager.render({
                blockId: 'R-A-19746878-3',
                type: 'fullscreen',
                platform: 'touch',
                onClose: function() { showFinalScoreWindow(); },
                onError: function() { showFinalScoreWindow(); }
            });
        });
    } else {
        setTimeout(() => { showFinalScoreWindow(); }, 1000);
    }
}

function showFinalScoreWindow() {
    finalScoreDisplay.innerHTML = score;
    modal.classList.remove('hidden');
}

// --- ЛОГИКА ОКОН И КНОПОК ---
document.getElementById('wheel-open-btn').addEventListener('click', () => wheelModal.classList.remove('hidden'));
document.getElementById('wheel-close-btn').addEventListener('click', () => wheelModal.classList.add('hidden'));

document.getElementById('spin-btn').addEventListener('click', () => {
    const randomDegree = Math.floor(Math.random() * 360) + 1440;
    // Исправлено: добавлены корректные обратные кавычки для CSS-трансформации
    wheel.style.transform = `rotate(${randomDegree}deg)`;
    
    setTimeout(() => {
        let actualAngle = (360 - (randomDegree % 360)) % 360;
        if (actualAngle >= 0 && actualAngle < 90) {
            alert("🎉 Поздравляем! Ваш приз: +5 бесплатных ходов!");
            moves += 5;
        } else if (actualAngle >= 90 && actualAngle < 180) {
            alert("💎 Супер-приз! Следующие ходы принесут x2 очков!");
            comboMultiplier = 2;
        } else if (actualAngle >= 180 && actualAngle < 270) {
            alert("🔥 Поздравляем! Вы выиграли Огненный режим (Combo x3)!");
            comboMultiplier = 3;
            grid.classList.add('fire-mode');
            fireActive = true;
        } else if (actualAngle >= 270 && actualAngle < 360) {
            alert("🎉 Мега-удача! Ваш приз: +10 бесплатных ходов!");
            moves += 10;
        }
        movesDisplay.innerHTML = moves;
        // Исправлено: добавлены кавычки для вывода комбо
        comboDisplay.innerHTML = `x${comboMultiplier}`;
        wheelModal.classList.add('hidden');
    }, 3100);
});

document.getElementById('share-btn').addEventListener('click', () => {
    // Исправлено: добавлены кавычки для текста вызова друга
    const textChallenge = `⚔️ Я набрал рекордные ${score} очков в огненном режиме! Слабо побить? Принимай вызов по ссылке!`;
    navigator.clipboard.writeText(textChallenge);
    alert("Текст вызова скопирован! Отправь его другу в мессенджер Макс. 😉");
});

document.getElementById('reward-btn').addEventListener('click', () => {
    moves = 5;
    movesDisplay.innerHTML = moves;
    modal.classList.add('hidden');
    createBoard();
});

document.getElementById('restart-btn').addEventListener('click', createBoard);

// Логика кнопки «ИГРАТЬ» в Главном меню
// Логика кнопки «ИГРАТЬ» в Главном меню
document.getElementById('start-game-btn').addEventListener('click', function() {
    document.getElementById('start-menu').classList.add('fade-out');
    playExplosionSound(); 
    createBoard();

    // ВСТАВЛЯЕМ СЮДА НОВЫЙ КОД БАННЕРА ИЗ СКРИНШОТА:
    if (window.yaContextCb) {
        window.yaContextCb.push(() => {
            if (typeof Ya !== 'undefined' && Ya.Context && Ya.Context.AdvManager) {
                Ya.Context.AdvManager.render({
                    blockId: 'R-A-19746878-15',
                    renderTo: 'yandex_rtb_R-A-19746878-15'
                });
            }
        });
    }
});


