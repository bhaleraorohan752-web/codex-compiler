const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require("cors");
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- INITIALIZATION ---
const app = express();
const PORT = 5000;
const SECRET_KEY = "CODEX_PRO_SECRET_2026"; // Secure key for JWT

// 1. CORS Configuration: Allows frontend to send "Authorization" headers
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- DATABASE CONNECTION ---
const dbURI = "mongodb+srv://bhaleraorohan752_db_user:rohan%4021@devcluster.hvghecf.mongodb.net/?appName=DevCluster";
mongoose.connect(dbURI)
    .then(() => console.log("✅ MongoDB Connected: Cloud Storage Active"))
    .catch(err => console.error("❌ Database connection error:", err));

// --- MODELS ---

// User Schema: Stores encrypted credentials
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// Snippet Schema: Linked to a specific owner
const SnippetSchema = new mongoose.Schema({
    title: String,
    code: String,
    language: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});
const Snippet = mongoose.model('Snippet', SnippetSchema);

// --- AUTHENTICATION MIDDLEWARE ---
// Verifies the user's token before allowing them to Save or View snippets
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: "Access Denied: Please Login" });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.id; // Attach user ID to the request object
        next();
    } catch (err) { res.status(401).json({ error: "Session Expired" }); }
};

// --- AUTH ROUTES ---

// Signup: Encrypts password using bcrypt before saving
app.post('/auth/signup', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = new User({ username: req.body.username, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: "User Created Successfully" });
    } catch (e) { res.status(400).json({ error: "Username already exists" }); }
});

// Login: Verifies password and returns a JWT token
app.post('/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username });
    if (user && await bcrypt.compare(req.body.password, user.password)) {
        const token = jwt.sign({ id: user._id }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, username: user.username });
    } else {
        res.status(401).json({ error: "Invalid username or password" });
    }
});

// --- SECURE SNIPPET ROUTES ---

// Save: Automatically links the snippet to the logged-in user
app.post('/save', authenticate, async (req, res) => {
    try {
        const { title, code, language } = req.body;
        const newSnippet = new Snippet({ title, code, language, owner: req.userId });
        await newSnippet.save();
        res.status(201).json({ message: "Snippet Saved!" });
    } catch (error) { res.status(500).json({ error: "Failed to save" }); }
});

// Get Snippets: Only returns snippets belonging to the logged-in user
app.get('/snippets', authenticate, async (req, res) => {
    try {
        const userSnippets = await Snippet.find({ owner: req.userId }).sort({ createdAt: -1 });
        res.json(userSnippets);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

app.delete('/snippets/:id', authenticate, async (req, res) => {
    try {
        await Snippet.findOneAndDelete({ _id: req.params.id, owner: req.userId });
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: "Delete failed" }); }
});

// --- REAL-TIME COMPILER (SOCKET.IO) ---

io.on('connection', (socket) => {
    console.log('⚡ User connected to secure terminal');

    socket.on('runCode', ({ code, language }) => {
        let fileName = `temp_${Date.now()}`;
        
        // Java requires filename to match Public Class name
        if (language === 'java') {
            const match = code.match(/public\s+class\s+([a-zA-Z_$][a-zA-Z\d_$]*)/);
            fileName = (match && match[1]) ? match[1] : "Main";
        }
        
        const extMap = { c: 'c', cpp: 'cpp', python: 'py', java: 'java' };
        const filePath = path.join(__dirname, `${fileName}.${extMap[language]}`);

        fs.writeFile(filePath, code, (err) => {
            if (err) return socket.emit('output', 'Internal Error: File System Locked');

            const compileCmd = getCompileCommand(language, fileName, __dirname);
            const child = spawn('sh', ['-c', compileCmd]);

            // Stream STDOUT/STDERR to frontend
            child.stdout.on('data', (data) => socket.emit('output', data.toString()));
            child.stderr.on('data', (data) => socket.emit('output', data.toString()));

            // Handle user interactive inputs
            socket.on('sendInput', (input) => {
                if (child.stdin.writable) child.stdin.write(input + '\n');
            });

            child.on('close', () => {
                socket.emit('output', '\n[Process Finished]');
                
                // Final Cleanup: Prevents server clutter
                fs.unlink(filePath, () => {});
                if (language === 'c' || language === 'cpp') {
                    const outPath = path.join(__dirname, `${fileName}.out`);
                    if (fs.existsSync(outPath)) fs.unlink(outPath, () => {});
                }
                // Important: Clean up listeners to prevent memory leaks
                socket.removeAllListeners('sendInput');
            });
        });
    });

    socket.on('disconnect', () => console.log('User disconnected'));
});

// Command Generator for Docker/Linux Environment
function getCompileCommand(language, fileName, dir) {
    switch (language) {
        case 'c': return `gcc "${dir}/${fileName}.c" -o "${dir}/${fileName}.out" && "${dir}/${fileName}.out"`;
        case 'cpp': return `g++ "${dir}/${fileName}.cpp" -o "${dir}/${fileName}.out" && "${dir}/${fileName}.out"`;
        case 'python': return `python3 "${dir}/${fileName}.py"`;
        case 'java': return `javac "${dir}/${fileName}.java" && java -cp "${dir}" ${fileName}`;
        default: return '';
    }
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CodeX Backend running on http://localhost:${PORT}`);
});