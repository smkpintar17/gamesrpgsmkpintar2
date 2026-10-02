// Ganti URL berikut dengan Web App URL dari Google Apps Script milik Anda
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxHdcHvUuDCptR4HeYJCgoENs3jjZG_Fdg8YH-3G-LctyWlkvnrBkWdK6mslRehOkp-/exec";

let currentUser = null;
let currentLevel = 1;
let score = 0;

// Variabel Animasi Canvas
let heroY = 210;
let isAttacking = false;
let isMonsterHit = false;
let animationFrameId = null;

const questionsData = generateQuestions();

window.onload = () => {
    const savedUser = localStorage.getItem("rpg_smk_user");
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            if (currentUser.isAdmin) {
                showAdminDashboard();
            } else {
                currentLevel = currentUser.level || 1;
                score = currentUser.score || 0;
                showGameScreen();
            }
        } catch (e) {
            localStorage.removeItem("rpg_smk_user");
        }
    }
};

function switchTab(tab) {
    document.getElementById("btn-tab-login").classList.toggle("active", tab === 'login');
    document.getElementById("btn-tab-register").classList.toggle("active", tab === 'register');
    document.getElementById("btn-tab-admin").classList.toggle("active", tab === 'admin');
    
    document.getElementById("form-login").classList.toggle("hidden", tab !== 'login');
    document.getElementById("form-register").classList.toggle("hidden", tab !== 'register');
    document.getElementById("form-admin").classList.toggle("hidden", tab !== 'admin');
}

// REGISTER PLAYER BARU (TANPA NISN)
function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById("reg-username").value.trim();
    const fullname = document.getElementById("reg-fullname").value.trim();
    const userClass = document.getElementById("reg-class").value;
    const password = document.getElementById("reg-password").value;

    const allUsers = getAllUsers();
    if (allUsers.some(u => u.username === username)) {
        alert("Username sudah digunakan! Harap pakai username lain.");
        return;
    }

    const user = {
        fullname: fullname,
        class: userClass,
        username: username,
        password: password,
        level: 1,
        score: 0,
        isAdmin: false
    };

    saveUserToStorage(user);
    currentUser = user;
    localStorage.setItem("rpg_smk_user", JSON.stringify(user));
    
    // Kirim data registrasi awal ke Google Sheets
    sendToGoogleSheets("Registrasi Baru", "-");
    
    showGameScreen();
}

// LOGIN PLAYER
function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById("login-username").value.trim();
    const p = document.getElementById("login-password").value;
    const allUsers = getAllUsers();

    const found = allUsers.find(item => item.username === u && item.password === p);
    if (found) {
        currentUser = found;
        currentLevel = found.level || 1;
        score = found.score || 0;
        localStorage.setItem("rpg_smk_user", JSON.stringify(found));
        showGameScreen();
    } else {
        alert("Username atau Password salah!");
    }
}

// LOGIN SUPERADMIN
function handleAdminLogin(e) {
    e.preventDefault();
    const pass = document.getElementById("admin-password").value;
    if (pass === "admin123") {
        currentUser = { fullname: "Superadmin", isAdmin: true };
        localStorage.setItem("rpg_smk_user", JSON.stringify(currentUser));
        showAdminDashboard();
    } else {
        alert("Password Superadmin Salah!");
    }
}

function handleLogout() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    localStorage.removeItem("rpg_smk_user");
    location.reload();
}

function showGameScreen() {
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("admin-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    
    document.getElementById("hud-name").innerText = currentUser.fullname;
    document.getElementById("hud-class").innerText = currentUser.class;
    
    updateHUD();
    loadQuestion();
    initChibiCanvas();
}

function showAdminDashboard() {
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.add("hidden");
    document.getElementById("admin-screen").classList.remove("hidden");

    const tbody = document.getElementById("leaderboard-body");
    tbody.innerHTML = "";

    let players = getAllUsers().filter(u => !u.isAdmin);
    players.sort((a, b) => b.score - a.score);

    players.forEach((p, index) => {
        const row = `<tr>
            <td><strong>#${index + 1}</strong></td>
            <td>${p.fullname}</td>
            <td>${p.class}</td>
            <td>${p.username}</td>
            <td>Level ${p.level || 1}</td>
            <td><strong style="color: #00fff5">${p.score || 0}</strong></td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

function updateHUD() {
    document.getElementById("hud-level").innerText = `Level ${currentLevel}`;
    document.getElementById("hud-score").innerText = `Skor: ${score}`;
    
    currentUser.level = currentLevel;
    currentUser.score = score;
    saveUserToStorage(currentUser);
    localStorage.setItem("rpg_smk_user", JSON.stringify(currentUser));
}

function loadQuestion() {
    const q = questionsData[currentLevel - 1];
    document.getElementById("quiz-level-title").innerText = `Misi Level ${currentLevel} / 53`;
    document.getElementById("quiz-category").innerText = `Kategori: ${q.category}`;
    document.getElementById("quiz-question").innerText = q.question;

    const optContainer = document.getElementById("options-container");
    const essayContainer = document.getElementById("essay-container");

    if (currentLevel <= 50) {
        optContainer.classList.remove("hidden");
        essayContainer.classList.add("hidden");

        const buttons = optContainer.getElementsByClassName("btn-option");
        q.options.forEach((opt, idx) => {
            buttons[idx].innerText = `${String.fromCharCode(65 + idx)}. ${opt}`;
        });
    } else {
        optContainer.classList.add("hidden");
        essayContainer.classList.remove("hidden");
        document.getElementById("essay-input").value = "";
    }
}

function submitAnswer(selectedIndex) {
    const q = questionsData[currentLevel - 1];
    if (selectedIndex === q.correct) {
        score += 20;
        triggerChibiAttack(() => {
            sendToGoogleSheets(`Level ${currentLevel} Selesai`, "-");
            alert("Jawaban Benar! Hero Chibi berhasil mengalahkan monster!");
            nextLevel();
        });
    } else {
        alert("Jawaban Salah! Ayo coba lagi!");
    }
}

function submitEssay() {
    const text = document.getElementById("essay-input").value.trim();
    if (!text) {
        alert("Isi jawaban refleksi kamu secara jujur!");
        return;
    }

    triggerChibiAttack(() => {
        sendToGoogleSheets(`Level ${currentLevel} Esai`, text);
        alert("Jawaban refleksi tersimpan dan terkirim ke Google Sheets!");
        nextLevel();
    });
}

function nextLevel() {
    if (currentLevel < 53) {
        currentLevel++;
        updateHUD();
        loadQuestion();
    } else {
        alert("Selamat! Kamu telah berhasil menamatkan seluruh level RPG SMK PINTAR!");
    }
}

// CANVAS HERO CHIBI 2D
function initChibiCanvas() {
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    let frame = 0;

    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Latar Belakang Kartun Imut
        ctx.fillStyle = "#2d4059";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ea5455";
        ctx.fillRect(0, 290, canvas.width, 90);

        // Bintang Latar
        ctx.fillStyle = "#ffde7d";
        ctx.fillRect(100, 50, 4, 4);
        ctx.fillRect(300, 80, 6, 6);
        ctx.fillRect(600, 40, 5, 5);

        // HERO CHIBI
        const hX = isAttacking ? 480 : 160;
        const bounce = Math.sin(frame * 0.1) * 5;
        const hY = heroY + bounce;

        // Syal Merah
        ctx.fillStyle = "#ff2e63";
        ctx.fillRect(hX - 20, hY + 20, 25, 12);

        // Badan
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(hX + 10, hY + 35, 25, 25);
        ctx.fillStyle = "#222";
        ctx.fillRect(hX + 12, hY + 45, 21, 15);

        // Kepala Chibi Besar
        ctx.fillStyle = "#ffdfba";
        ctx.fillRect(hX, hY - 10, 45, 45);

        // Rambut & Ikat Kepala
        ctx.fillStyle = "#333";
        ctx.fillRect(hX - 5, hY - 20, 55, 15);
        ctx.fillStyle = "#ff2e63";
        ctx.fillRect(hX - 2, hY - 2, 49, 8);

        // Mata
        ctx.fillStyle = "#000";
        ctx.fillRect(hX + 26, hY + 8, 10, 14);
        ctx.fillStyle = "#fff";
        ctx.fillRect(hX + 28, hY + 10, 4, 4);

        // Efek Serangan
        if (isAttacking) {
            ctx.fillStyle = "#ffde7d";
            ctx.beginPath();
            ctx.arc(hX + 70, hY + 20, 30, 0, Math.PI * 2);
            ctx.fill();
        }

        // MONSTER CHIBI
        const mX = 580;
        const mY = 220 + Math.cos(frame * 0.1) * 4;
        
        ctx.fillStyle = isMonsterHit ? "#fff" : "#00b4d8";
        ctx.beginPath();
        ctx.arc(mX, mY, 35, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(mX - 10, mY - 5, 8, 0, Math.PI * 2);
        ctx.arc(mX + 10, mY - 5, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.fillRect(mX - 12, mY - 7, 4, 4);
        ctx.fillRect(mX + 8, mY - 7, 4, 4);

        frame++;
        animationFrameId = requestAnimationFrame(render);
    }
    render();
}

function triggerChibiAttack(callback) {
    isAttacking = true;
    setTimeout(() => {
        isMonsterHit = true;
        setTimeout(() => {
            isAttacking = false;
            isMonsterHit = false;
            callback();
        }, 300);
    }, 400);
}

// LOCAL STORAGE MANAGEMENT
function getAllUsers() {
    try {
        const data = localStorage.getItem("rpg_smk_all_users");
        return data ? JSON.parse(data) : [];
    } catch(e) {
        return [];
    }
}

function saveUserToStorage(user) {
    let users = getAllUsers();
    const index = users.findIndex(u => u.username === user.username);
    if (index >= 0) {
        users[index] = user;
    } else {
        users.push(user);
    }
    localStorage.setItem("rpg_smk_all_users", JSON.stringify(users));
}

// SYNC DATABASE GOOGLE SHEETS
function sendToGoogleSheets(status, essayText) {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("YOUR_SCRIPT_ID_HERE")) return;

    const data = {
        fullname: currentUser.fullname,
        class: currentUser.class,
        username: currentUser.username,
        level: currentLevel,
        score: score,
        status: status,
        essay: essayText
    };

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    }).catch(err => console.error("Sheet Error:", err));
}

// SOAL KUIS (LEVEL 1 - 53)
function generateQuestions() {
    let list = [];

    // Kelas X RPL (1 - 16)
    for (let i = 1; i <= 16; i++) {
        list.push({
            category: "Kelas X RPL - Daspro & Algoritma",
            question: `[Soal ${i}] Simbol flowchart berbentuk jajar genjang digunakan untuk fungsi apa?`,
            options: ["Input / Output Data", "Proses Perhitungan", "Keputusan (Decision)", "Awal/Akhir Program"],
            correct: 0
        });
    }

    // Kelas XI RPL (17 - 34)
    for (let i = 17; i <= 34; i++) {
        list.push({
            category: "Kelas XI RPL - OOP & Database",
            question: `[Soal ${i}] Perintah SQL yang digunakan untuk mengambil seluruh data dari tabel 'siswa' adalah...`,
            options: ["UPDATE siswa SET *", "SELECT * FROM siswa", "DELETE FROM siswa", "INSERT INTO siswa"],
            correct: 1
        });
    }

    // Kelas XII RPL (35 - 50)
    for (let i = 35; i <= 50; i++) {
        list.push({
            category: "Kelas XII RPL - Framework & Mobile",
            question: `[Soal ${i}] Di bawah ini yang merupakan framework UI berbasis Bahasa Dart untuk membuat aplikasi mobile adalah...`,
            options: ["Laravel", "Flutter", "React Native", "CodeIgniter"],
            correct: 1
        });
    }

    // Level Bonus Esai SMK 17 Muncar (51 - 53)
    list.push({
        category: "Level Bonus 51 - Refleksi Sekolah",
        question: "Tuliskan harapan dan keinginan jujur Anda untuk kemajuan sarana dan pembelajaran di SMK 17 Muncar!"
    });
    list.push({
        category: "Level Bonus 52 - Pengembangan Kompetensi RPL",
        question: "Hal atau bidang spesifik apa saja yang ingin Anda kembangkan dalam Program Keahlian RPL (misal: Web Dev, Mobile App, Game Dev)?"
    });
    list.push({
        category: "Level Bonus 53 - Komitmen Karir Masa Depan",
        question: "Apa rencana dan target karir Anda setelah lulus dari Jurusan RPL SMK 17 Muncar?"
    });

    return list;
}
