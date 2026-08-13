const width = 8;
const candyColors = ['color-0', 'color-1', 'color-2', 'color-3', 'color-4'];
const grid = document.getElementById('grid');
let board = [];
let flashActive = false; // Режим мигания огоньков при взрыве item0
let score = 0;
let moves = 30;
let comboMultiplier = 1; 
let matchesFoundInTurn = false;
let gameInterval = null; // Будет хранить ссылку на игровой цикл


const scoreDisplay = document.getElementById('score');
const comboDisplay = document.getElementById('combo');
const movesDisplay = document.getElementById('moves');
const modal = document.getElementById('game-over-modal');
const wheelModal = document.getElementById('wheel-modal');
const finalScoreDisplay = document.getElementById('final-score');
const wheel = document.getElementById('wheel');

let firstClickCell = null;
let isRefilling = false;

// --- ДВИЖОК НАСТОЯЩЕГО ОГНЯ (CANVAS) ---
const canvas = document.getElementById('fireCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let fireActive = false; // Горит ли огонь на максимум?

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor() {
        // Спавним частицы внизу игрового поля
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

        // Когда огонь догорает, превращаем его в дым
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
    
    // Если взорвался item0 — генерируем дополнительные супер-вспышки
    if (flashActive) {
        pCount = 25; // Очень много ярких частиц
    }
    
    for (let i = 0; i < pCount; i++) {
        particles.push(new Particle());
    }

    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        
        // Модифицируем цвет, если включен режим вспышек от item0
        if (flashActive) {
            ctx.fillStyle = `hsl(${Math.random() * 360}, 100%, 60%)`; // Случайные неоновые цвета
        } else {
            particles[i].draw();
            continue;
        }

        ctx.beginPath();
        // Разбрасываем частицы хаотично по всему экрану для эффекта мигания
        let xPos = flashActive ? Math.random() * canvas.width : particles[i].x;
        let yPos = flashActive ? Math.random() * canvas.height : particles[i].y;
        ctx.arc(xPos, yPos, particles[i].radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
}


// Постоянный цикл прорисовки пламени (60 кадров в секунду)
function animateFire() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    handleParticles();
    requestAnimationFrame(animateFire);
}
animateFire();
// ----------------------------------------

// Переменные для отслеживания свайпов
let touchStartX = 0;
let touchStartY = 0;
let touchIdBeingDragged = null;

function createBoard() {
    // 1. ОЧЕНЬ ВАЖНО: Если таймер уже работал в фоне, полностью останавливаем его
    if (gameInterval) clearInterval(gameInterval);
    
    // 2. Очищаем холст сетки от старых копий игры
    grid.innerHTML = '';
    board = [];
    
    // Сброс очков и ходов
    score = 0;
    moves = 30;
    comboMultiplier = 1;
    scoreDisplay.innerHTML = score;
    movesDisplay.innerHTML = moves;
    comboDisplay.innerHTML = 'x1';
    modal.classList.add('hidden');
    grid.classList.remove('fire-mode');
    fireActive = false;

    // Генерируем фишки
    for (let i = 0; i < width * width; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.setAttribute('id', i);
        let randomColor = Math.floor(Math.random() * candyColors.length);
        cell.classList.add(candyColors[randomColor]);
        grid.appendChild(cell);
        board.push(cell);

        // Управление свайпами
        cell.addEventListener('touchstart', function(e) {
            if (isRefilling || moves <= 0) return;
            touchIdBeingDragged = parseInt(this.id);
            touchStartX = e.touches.clientX;
            touchStartY = e.touches.clientY;
        }, { passive: true });

        cell.addEventListener('touchend', function(e) {
            if (isRefilling || moves <= 0 || touchIdBeingDragged === null) return;

            let touchEndX = e.changedTouches.clientX;
            let touchEndY = e.changedTouches.clientY;
            let diffX = touchEndX - touchStartX;
            let diffY = touchEndY - touchStartY;
            const minSwipeDistance = 30; 
            let targetId = null;

            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (Math.abs(diffX) > minSwipeDistance) {
                    if (diffX > 0 && touchIdBeingDragged % width < width - 1) targetId = touchIdBeingDragged + 1;
                    else if (diffX < 0 && touchIdBeingDragged % width > 0) targetId = touchIdBeingDragged - 1;
                }
            } else {
                if (Math.abs(diffY) > minSwipeDistance) {
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
            }
            touchIdBeingDragged = null;
        }, { passive: true });
    }

    // Записываем таймер в глобальную переменную, чтобы он не раздваивался
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

// --- ЛОГИКА ОКРИТИЧЕСКИХ ОКОН И КНОПОК ---
function endGame() {
    finalScoreDisplay.innerHTML = score;
    modal.classList.remove('hidden');
    fireActive = false;
}

document.getElementById('wheel-open-btn').addEventListener('click', () => wheelModal.classList.remove('hidden'));
document.getElementById('wheel-close-btn').addEventListener('click', () => wheelModal.classList.add('hidden'));

document.getElementById('spin-btn').addEventListener('click', () => {
    // 1. Генерируем случайный угол (минимум 4 полных оборота + случайный хвост)
    const randomDegree = Math.floor(Math.random() * 360) + 1440;
    
    // Запускаем вращение колеса в CSS
    wheel.style.transform = `rotate(${randomDegree}deg)`;
    
    setTimeout(() => {
                // Высчитываем реальный угол остановки колеса относительно верха
        let actualAngle = (360 - (randomDegree % 360)) % 360;
        
        // Обновленная точная проверка для сетки 2х2:
        if (actualAngle >= 0 && actualAngle < 90) {
            // Под стрелкой верхний левый сектор
            alert("🎉 Поздравляем! Ваш приз: +5 бесплатных ходов!");
            moves += 5;
        } else if (actualAngle >= 90 && actualAngle < 180) {
            // Под стрелкой нижний левый сектор
            alert("💎 Супер-приз! Следующие ходы принесут x2 очков!");
            comboMultiplier = 2;
        } else if (actualAngle >= 180 && actualAngle < 270) {
            // Под стрелкой нижний правый сектор
            alert("🔥 Поздравляем! Вы выиграли Огненный режим (Combo x3)!");
            comboMultiplier = 3;
            grid.classList.add('fire-mode');
            fireActive = true;
        } else if (actualAngle >= 270 && actualAngle < 360) {
            // Под стрелкой верхний правый сектор
            alert("🎉 Мега-удача! Ваш приз: +10 бесплатных ходов!");
            moves += 10;
        }

        
        // Обновляем текст на экране и закрываем колесо
        movesDisplay.innerHTML = moves;
        comboDisplay.innerHTML = `x${comboMultiplier}`;
        wheelModal.classList.add('hidden');
        
    }, 3100); // 3.1 секунды крутится колесо
});


document.getElementById('share-btn').addEventListener('click', () => {
    const textChallenge = `⚔️ Я набрал рекордные ${score} очков в огненном режиме! Слабо побить? Принимай вызов по ссылке!`;
    if (typeof MaxSDK !== 'undefined') {
        MaxSDK.share({ title: "Дуэль в Три в Ряд!", text: textChallenge, url: window.location.href });
    } else {
        navigator.clipboard.writeText(textChallenge);
        alert("Текст вызова скопирован! Отправь его другу в мессенджер Макс. 😉");
    }
});

document.getElementById('reward-btn').addEventListener('click', () => {
    moves = 5;
    movesDisplay.innerHTML = moves;
    modal.classList.add('hidden');
    createBoard(); // Корректный перезапуск вместо жесткой перезагрузки страницы
});

document.getElementById('restart-btn').addEventListener('click', createBoard);

// ЕДИНСТВЕННЫЙ КЛЮЧЕВОЙ ЗАПУСК ИГРЫ ИЗ МЕНЮ
document.getElementById('start-game-btn').addEventListener('click', function() {
    document.getElementById('start-menu').classList.add('fade-out');
    if (typeof playExplosionSound === 'function') {
        playExplosionSound(); 
    }
    createBoard();
});
