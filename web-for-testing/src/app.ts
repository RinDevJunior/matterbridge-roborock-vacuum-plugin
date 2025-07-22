import express, { Request, Response } from 'express';
import RoborockService from './ext/roborockService.js';
import ClientManager from './ext/clientManager.js';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';
import { Device, RequestMessage, RoborockAuthenticateApi, RoborockIoTApi, UserData } from './ext/roborockCommunication/index.js';
import axios from 'axios';
import { Socket } from 'net';
import { getAccountStore } from './accountStore.js';

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Application specific logging, throwing an error, or other logic here
});

const app = express();
const port = 3000;
const log = new AnsiLogger({ logName: 'Main', logLevel: LogLevel.DEBUG });

var roborockService: RoborockService;
var clientManager: ClientManager;
var userData: UserData;
const devices: Device[] = [];
var usname: string;
var connected = true;
var connectedDUID = '';
var isConnected = false;

//--------------------------
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.render('index', { title: 'My Express WebUI' });
});

app.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  console.warn(`Login attempt with username: ${username}, password: ${password}`);
  if (!username) {
    res.json({ error: 'Username are required' });
    return;
  }
  axios.interceptors.request.use((request: any) => {
    log.notice('Axios Request:', {
      method: request.method,
      url: request.url,
      data: request.data,
      headers: request.headers,
    });
    return request;
  });

  axios.interceptors.response.use((response: any) => {
    log.notice('Axios Response:', {
      status: response.status,
      data: response.data,
      headers: response.headers,
      url: response.config.url,
    });
    return response;
  });

  clientManager = new ClientManager(log);
  roborockService = new RoborockService(
    () => new RoborockAuthenticateApi(log, axios),
    (logger, ud) => new RoborockIoTApi(ud, logger),
    60,
    clientManager,
    log,
  );

  const userDataMap = getAccountStore();
  const selectedUserData = userDataMap.get(username);
  console.warn(`Selected user data for ${username}:`, JSON.stringify(selectedUserData));

  try {
    userData = await roborockService.loginWithPassword(
      username,
      password,
      async () => {
        return password.length > 0 ? undefined : selectedUserData;
      },
      async (userData) => {
        console.warn('User data received:', JSON.stringify(userData));
      },
    );

    const dvs = await roborockService.listDevices(username);

    devices.push(...dvs);

    isConnected = false;

    if (userData) {
      usname = username;
      res.json({ success: true, devices: dvs, userData });
    } else {
      res.json({ success: false, error: 'Invalid username or password' });
    }
  } catch (error) {
    res.json({ success: false, error });
  }
});

app.post('/run', async (req: Request, res: Response) => {
  const { duid, command, props, secure, userData1, device1 } = req.body;
  if (!duid || !command) {
    res.json({ error: 'Nothing to do' });
    return;
  }
  let device = devices.find((x) => x.duid == duid);
  if (!device) {
    res.json({ result: `device not found` });
    return;
  }

  if (!isConnected) {
    if (connected && duid != connectedDUID && roborockService) {
      roborockService.stopService();
    }

    await roborockService.initializeMessageClient(usname, device, userData);

    roborockService.setDeviceNotify(async (messageSource, homeData) => {
      console.warn(`${messageSource}: ${JSON.stringify(homeData)}`);
    });
    await roborockService.initializeMessageClientForLocal(device);

    roborockService.activateDeviceNotify(device);

    connected = true;
    connectedDUID = duid;
    isConnected = true;
  }

  // const map_info = await roborockService.getMapInformation(duid);
  // const rooms = map_info?.maps?.[0]?.rooms ?? [];
  // console.warn(`Rooms: ${JSON.stringify(rooms)}`);

  //const xx = await roborockService.getRoomIdFromMap(duid);
  //console.warn(`Room ID: ${xx}`);

  const data = await roborockService.customGet(duid, new RequestMessage({ method: command, params: props, secure }));
  res.json({ command, data, secure: false });
});

app.post('/try-connect', async (req: Request, res: Response) => {
  const ip = req.body.ip ?? '192.168.202.65';
  const port = 58867;
  const socket = new Socket();
  socket.on('connect', () => {
    console.log(ip, 'Connected!');
    setTimeout(() => socket.end(), 3000);
  });
  socket.on('error', (err) => {
    console.error(ip, 'Error:', err);
  });
  socket.connect(port, ip);
  res.json({ result: `ok` });
});

app.post('/disconnect', async (req: Request, resp: Response) => {
  roborockService.stopService();

  resp.json({
    success: true,
  });
});

app.post('/call-api', async (req: Request, resp: Response) => {
  const { api } = req.body;
  if (!api) {
    resp.json({ error: 'API is required' });
    return;
  }

  const result = await roborockService.getCustomAPI(api);
  resp.json({
    success: true,
    result,
  });
});

app.listen(port, () => {
  console.log(`WebUI listening at http://localhost:${port}`);
});
