import { Socket } from 'net';
const ip = '192.168.100.1';
const port = 58867;
const socket = new Socket();
socket.on('connect', () => {
  console.log('Connected!');
  setTimeout(() => socket.end(), 3000);
});
socket.on('error', (err) => {
  console.error('Error:', err);
});
socket.connect(port, ip);
