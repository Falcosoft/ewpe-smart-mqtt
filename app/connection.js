const dgram = require("dgram");
const logger = require("winston");
const EventEmitter = require("events");
const {
    encrypt,
    decrypt,
    defaultKey,
    encryptV2,
    decryptV2,
    defaultKeyV2,
} = require("./encryptor");

const commandsMap = {
    bind: "bindok",
    status: "dat",
    cmd: "res",
};

class Connection extends EventEmitter {
    constructor(address) {
        super();
        this.socket = dgram.createSocket("udp4");
        this.devices = {};  
        this.timeoutId = null;      

        this.socket.on("message", this.handleResponse.bind(this));

        this.socket.on("listening", () => {
            const socketAddress = this.socket.address();
            logger.info(
                `Socket server is listening on ${socketAddress.address}:${socketAddress.port}`
            );

            this.scan(address);
            this.timeoutId = setInterval(() => this.scan(address), 3000); //Retry if needed...
        });

        this.socket.on("error", (error) => {
            logger.error(error.message);
        });

        this.socket.bind();
    }

    registerKey(deviceId, key) {
        this.devices[deviceId] = key;       
    }

    getTimeOutId() {
        return this.timeoutId;
    }

    getEncryptionKey(deviceId) {
        return this.devices[deviceId] || defaultKey;
    }

    scan(networks) {
        const message = Buffer.from(JSON.stringify({ t: "scan" }));

        this.socket.setBroadcast(true);

        networks.split(";").forEach((networkAddress) => {
            logger.info(
                `Scanning network ${networkAddress} for available devices...`
            );
            this.socket.send(message, 0, message.length, 7000, networkAddress, (err) => {
							if(err) 
                            {
                                logger.error(err.message);							    
                            }
					});
        });
    }

    async sendRequest(deviceId, address, port, useV2Encryption, key, payload) {
        return new Promise((resolve, reject) => {          
            const request = {
                cid: "app",
                i: key === defaultKey ? 1 : 0,
                t: "pack",
                uid: 0,                
            };
            if ((key !== defaultKey || payload.t === "bind") && useV2Encryption) {
                const { pack, tag } =
                    key !== defaultKey
                        ? encryptV2(payload, key)
                        : encryptV2(payload);
                request.pack = pack;
                request.tag = tag;
                request.tcid = deviceId;
            } else {
                request.pack = encrypt(payload, key);
            }

            const messageHandler = (msg, rinfo) => {
                const message = JSON.parse(msg.toString());
                let response;

                // Check device address data
                if (rinfo.address !== address || rinfo.port !== port) {
                    return;
                }

                logger.debug(
                    `Received message from ${message.cid} (${rinfo.address}:${
                        rinfo.port
                    }) ${msg.toString()}`
                );

                try {
                    if (message?.tag) {
                        response =
                            key !== defaultKey
                                ? decryptV2(message.pack, message.tag, key)
                                : decryptV2(message.pack, message.tag);
                    } else {
                        response = decrypt(message.pack, key);
                    }
                } catch (e) {
                    logger.error(
                        `Can not decrypt message from ${message.cid} (${rinfo.address}:${rinfo.port}) with key ${key}`
                    );
                    logger.debug(message.pack);
                    return;
                }

                if ((response.t !== commandsMap[payload.t]) && (payload.t === "queryT" && response.t !== "listT") && (payload.t === "setT" && response.t !== "resT")) {
                    return;
                }

                if (response.mac !== payload.mac) {
                    return;
                }

                if (this.socket && this.socket.off) {
                    this.socket.off("message", messageHandler);
                }

                resolve(response);
            };

            /*
            console.log(
                `Sending request to ${address}:${port}: ${JSON.stringify(
                    payload
                )}`
            );
            */

            this.socket.on("message", messageHandler);

            const toSend = Buffer.from(JSON.stringify(request));
            this.socket.send(toSend, 0, toSend.length, port, address);
        });
    }

    handleResponse(msg, rinfo) {
        let message, response;

        try {
            message = JSON.parse(msg.toString());
        } catch {
            logger.error(
                `Device ${rinfo.address}:${rinfo.port} sent invalid JSON that can not be parsed`
            );
            logger.debug(msg);
            return;
        }

        const key = this.getEncryptionKey(message.cid);

        try {
            if (message?.tag) {
                response =
                    key !== defaultKey
                        ? decryptV2(message.pack, message.tag, key)
                        : decryptV2(message.pack, message.tag);
            } else {
                response = decrypt(message.pack, key);
            }
        } catch {
            logger.error(
                `Can not decrypt message from ${message.cid} (${rinfo.address}:${rinfo.port}) with key ${key}`
            );
            logger.debug(message.pack);
            return;
        }

        this.emit(response.t, response, rinfo);
    }
}

module.exports = Connection;
