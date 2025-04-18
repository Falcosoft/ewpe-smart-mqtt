const logger = require("winston");
const EventEmitter = require("events");
const Connection = require("./connection");
const { defaultKey } = require("./encryptor");
const { clearInterval } = require("timers");
const TEMPERATURE_SENSOR_OFFSET = -40;

// https://github.com/tomikaa87/gree-remote
const statusKeys = [   
    "Pow",
    "Mod",
    "TemUn",
    "SetTem",
    "TemRec",
    "WdSpd",
    "Air",
    "Blo",
    "Health",
    "SwhSlp",
    "Lig",
    "SwingLfRig",
    "SwUpDn",
    "Quiet",
    "Tur",
    "SvSt",
    "TemSen",
    "HumSen",
    "host",
    "time",    
];

class DeviceManager extends EventEmitter {
    constructor(networkAddress) {
        super();
        this.connection = new Connection(networkAddress);
        this.devices = {};

        this.connection.on("dev", this._registerDevice.bind(this));
    }

    async _registerDevice(message, rinfo) {
        const deviceId = message.cid || message.mac;
        
        //This detection is not bullet proof...
        let useV2Encryption = message.ver.startsWith("V3");
        
        logger.info(
            `New device found: ${message.model} (mac: ${deviceId}), binding...`
        );        
        const { address, port } = rinfo;   
        
        clearInterval(this.connection.getTimeOutId()); //clear if found...

        const { key } = await this.connection.sendRequest(deviceId,
            address,
            port,
            useV2Encryption,
            defaultKey,
            {
                mac: deviceId,
                t: "bind",
                uid: 0,
            }
        );

        const device = {
            ...message,
            address,
            port,
            key,
            t: undefined,
            useV2Encryption,
        };

        this.devices[deviceId] = device;

        this.connection.registerKey(deviceId, key);

        this.emit("device_bound", deviceId, device);
        logger.info(
            `New device bound: ${device.model} (${device.address}:${device.port})`
        );

        return device;
    }

    getDevices() {
        return Object.values(this.devices);
    }

    async getDeviceStatus(deviceId) {
        const device = this.devices[deviceId];

        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        const payload = {
            cols: statusKeys,
            mac: device.mac,
            t: "status",
        };

        const response = await this.connection.sendRequest(deviceId,
            device.address,
            device.port,
            device.useV2Encryption,
            device.key,
            payload
        );
        const deviceStatus = response.cols.reduce(
            (acc, key, index) => ({
                ...acc,
                [key]: response.dat[index],
            }),
            {}
        );

        if ("TemSen" in deviceStatus && deviceStatus["TemSen"] != 0) {
            deviceStatus["TemSen"] += TEMPERATURE_SENSOR_OFFSET;
        }

        deviceStatus.mac = device.mac;
        this.emit("device_status", deviceId, deviceStatus);
        return deviceStatus;
    }    

    async setDeviceState(deviceId, state) {
        const device = this.devices[deviceId];

        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        const payload = {
            mac: device.mac,
            opt: Object.keys(state),
            p: Object.values(state),
            t: "cmd",
        };

        const response = await this.connection.sendRequest(deviceId,
            device.address,
            device.port,
            device.useV2Encryption,
            device.key,
            payload
        );
        const deviceStatus = response.opt.reduce(
            (acc, key, index) => ({
                ...acc,
                [key]: response.p[index],
            }),
            {}
        );
        
        this.emit("device_status", deviceId, deviceStatus);
        return deviceStatus;
    }

    async getDeviceTimers(deviceId, data) {
        const device = this.devices[deviceId];

        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        const payload =  {count:data.Count, index:data.TimerId, t:"queryT"};

        const response = await this.connection.sendRequest(deviceId,
            device.address,
            device.port,
            device.useV2Encryption,
            device.key,
            payload
        );
        
        this.emit("device_timer", deviceId, response);
        return response;
    }

    async setDeviceTimer(deviceId, data) {
        const device = this.devices[deviceId];

        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        const payload = {
            cmd:
            [
                {
                mac:[device.mac],
                opt:["Pow"],
                p:[data.Pow]
                }
            ],
             enable:1 - data.Active,
             hr:data.Hour,
             id :data.TimerId,
             min:data.Min,
             name: "ewpeTimer" + data.TimerId.toString() + (data.Pow == 1 ? "-start" : "-stop"),
             sec:0,
             t:"setT",
             tz:0,
             week :[data.Sun,data.Mon,data.Tue,data.Wed,data.Thu,data.Fri,data.Sat]
            };

        const response = await this.connection.sendRequest(deviceId,
            device.address,
            device.port,
            device.useV2Encryption,
            device.key,
            payload
        );
        
        this.emit("device_timer", deviceId, response);
        return response;
    }
}

module.exports = DeviceManager;
