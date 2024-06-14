const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const { createClient } = require('redis');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const redisClient = createClient();

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

redisClient.connect().catch(console.error);

mongoose.connect('mongodb://localhost/chatbot', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});

const messageSchema = new mongoose.Schema({
    username: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', async (socket) => {
    console.log('New client connected');

    try {
        const messages = await Message.find().sort('timestamp').exec();
        socket.emit('load messages', messages);
    } catch (err) {
        console.error('Error loading messages:', err);
    }

    socket.on('send message', async (data) => {
        const newMessage = new Message(data);
        try {
            await newMessage.save();
            io.emit('receive message', data);
        } catch (err) {
            console.error('Error saving message:', err);
        }

        try {
            await redisClient.lPush('messages', JSON.stringify(data));
        } catch (err) {
            console.error('Error pushing to Redis:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
