const mongoose = require('mongoose');

const snippetSchema = new mongoose.Schema({
    title: { type: String, required: true },
    code: { type: String, required: true },
    language: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Snippet', snippetSchema);