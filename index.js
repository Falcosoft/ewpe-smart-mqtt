require('dotenv').config()
const mqtt = require('mqtt');
const logger = require('winston');
const fs = require('fs');
const DeviceManager = require('./app/device_manager');

const networkAddress = process.env.NETWORK || '192.168.0.255';
const mqttServerAddress = process.env.MQTT_SERVER || 'mqtt://127.0.0.1';
const mqttBaseTopic = process.env.MQTT_BASE_TOPIC || 'ewpe-smart';
const pollInterval = process.env.DEVICE_POLL_INTERVAL || 5000;
const mqttServerUsername = process.env.MQTT_USERNAME || 'ewpe-bridge';
const mqttServerpassword = process.env.MQTT_PASSWORD || '';
const mqttServerport = process.env.MQTT_PORT || 1883;


const customLogFormat = logger.format.printf(info => {
    const message = JSON.stringify(info.message).replace(/["\\]/g, '')
    return `${info.timestamp} [${info.level}]: ${message}`;
})

logger.configure({
    level: process.env.LOG_LEVEL || 'info',
    format: logger.format.combine(
        logger.format.timestamp(),
        logger.format.colorize(),
        logger.format.prettyPrint(),
        customLogFormat
    ),
    transports: [
        new logger.transports.Console()
    ]
});

logger.info(`Trying to connect to MQTT server ${mqttServerAddress} ...`)
const mqttClient = mqtt.connect(mqttServerAddress, {
    username: mqttServerUsername,
    password: mqttServerpassword,
    port: mqttServerport
});

mqttClient.on('connect', () => {
    logger.info('Successfully connected to MQTT server');

    const deviceRegex = new RegExp(`^${mqttBaseTopic}\/([0-9a-h]{12})\/(.*)$`, 'i');
    const deviceManager = new DeviceManager(networkAddress, pollInterval);

    const getDeviceStatus = async (deviceId) => {
        const deviceStatus = await deviceManager.getDeviceStatus(deviceId);
        mqttClient.publish(`${mqttBaseTopic}/${deviceId}/status`, JSON.stringify(deviceStatus));
    }    

    mqttClient.publish(`${mqttBaseTopic}/bridge/state`, 'online');
    mqttClient.subscribe(`${mqttBaseTopic}/#`);

    mqttClient.on('message', async (topic, message) => {
        let matches;

        logger.info(`MQTT message received: ${topic} ${message}`);

        if (topic === `${mqttBaseTopic}/devices/list`) {
            mqttClient.publish(`${mqttBaseTopic}/devices`, JSON.stringify(deviceManager.getDevices()))
        } else {
            matches = deviceRegex.exec(topic);

            if (matches !== null) {
                const [, deviceId, command] = matches;

                if (command === 'get') {
                    getDeviceStatus(deviceId);
                }

                else if (command === 'set') {
                    const cmdResult = await deviceManager.setDeviceState(deviceId, JSON.parse(message));
                    mqttClient.publish(`${mqttBaseTopic}/${deviceId}/status`, JSON.stringify(cmdResult));
                }

                else if (command === 'getTimers') {
                    const cmdResult = await deviceManager.getDeviceTimers(deviceId, JSON.parse(message));
                    mqttClient.publish(`${mqttBaseTopic}/${deviceId}/timer`, JSON.stringify(cmdResult));
                }

                else if (command === 'setTimer') {
                    const cmdResult = await deviceManager.setDeviceTimer(deviceId, JSON.parse(message));
                    mqttClient.publish(`${mqttBaseTopic}/${deviceId}/timer`, JSON.stringify(cmdResult));
                }
            }
        }
    });

    deviceManager.on('device_bound', (deviceId, device) => {
        mqttClient.publish(`${mqttBaseTopic}/${deviceId}`, JSON.stringify(device));
        
        if(process.argv[2] == "0") 
            mqttClient.publish(`${mqttBaseTopic}/${deviceId}/set`, JSON.stringify({"Pow":0}));
        else if(process.argv[2] == "1") 
            mqttClient.publish(`${mqttBaseTopic}/${deviceId}/set`, JSON.stringify({"Pow":1}));       
        else if(process.argv[2] == "params.json") 
        {
            let data = fs.readFileSync(process.argv[2], 'utf8');
            data = data.replace(/\s+/g, '').trim();            
            mqttClient.publish(`${mqttBaseTopic}/${deviceId}/set`, data);
        }
            

        // Set Wifi when connected to AC hotspot:
        // echo -n "{\"psw\": \"YOUR_WIFI_PASSWORD\",\"ssid\": \"YOUR_WIFI_SSID\",\"t\": \"wlan\"}" | nc -cu 192.168.1.1 7000   
         
        getDeviceStatus(deviceId);        

        if (pollInterval > 0) {
            setInterval(() => getDeviceStatus(deviceId), pollInterval);
        }
    });
});

mqttClient.on('error', (error) => {
    logger.error(error);
});