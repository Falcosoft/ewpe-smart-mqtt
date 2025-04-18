# Falcosoft:
Modified to be used a portable way as much as possible (nodejs still needs to be installed) with the included local Client/Server combo GreeControl.exe.

This way no HomeAssistant, Mosquito MQTT server etc. need to be installed.<br/>
Also added new protocol support used by new devices (from firmware V3.x ?) as well as Humidity sensor and local timer support.  

Tested with Sinclair Marvin SIH-12BIM (firmware V3.20) and Sinclair ASH-12BIV  (firmware V1.21) 

![GreeControl](https://github.com/user-attachments/assets/1d6f1e89-c77c-4fe9-85b5-8f8d7051ed00)


# Original: ewpe-smart-mqtt
MQTT bridge for EWPE Smart powered devices which can be controled via WiFi using [EWPE Smart app](https://play.google.com/store/apps/details?id=com.gree.ewpesmart)

This project became possible thanks to great work of reverse engineering the original app protocol in [gree-remote](https://github.com/tomikaa87/gree-remote) project

![smart-1-600x600](https://user-images.githubusercontent.com/2734836/49315058-11f16e00-f4f5-11e8-84f5-81dc9cd813f0.jpg)

## Prerequisites

Setup and run MQTT server ([mosquitto](https://mosquitto.org/) is the easiest one)

## Installation

1. Clone or download this repository
```
git clone https://github.com/stas-demydiuk/ewpe-smart-mqtt
```
2. Install dependencies
```
npm install
```
3. Make initial configuration by setting enviromental variables

| Variable | Description | Default value |
| --- | --- | --- |
| MQTT_SERVER |MQTT server URI|mqtt://127.0.0.1|
| MQTT_PORT |MQTT Server Port|1883
| MQTT_USERNAME |MQTT Server Username|
| MQTT_PASSWORD |MQTT Server Password|
| MQTT_BASE_TOPIC |Base MQTT topic for bridge messages|ewpe-smart
| NETWORK |Network adress (or addresses separated by semicolon) to scan devices |192.168.1.255
| DEVICE_POLL_INTERVAL |Interval (ms) to poll device status|5000
| LOG_LEVEL |App Log level|info

4. Run the bridge
```
npm start
```

## Installation (Docker)

```
docker run -it \
    --network="host" \
    -e "MQTT_SERVER=mqtt://127.0.0.1" \
    -e "MQTT_BASE_TOPIC=ewpe-smart" \
    -e "NETWORK=192.168.1.255" \
    -e "DEVICE_POLL_INTERVAL=5000" \
    --name ewpe-smart-mqtt \
    demydiuk/ewpe-smart-mqtt:latest
```

## Installation (systemd service)

1. Clone or download the repository
```
cd /opt/
git clone https://github.com/stas-demydiuk/ewpe-smart-mqtt
```

2. Create service file
`sudo nano /etc/systemd/system/ewpe-smart-mqtt.service`

```
[Unit]
Description=ewpe-smart-mqtt
After=mosquitto.target

[Service]
ExecStart=/usr/bin/node /opt/ewpe-smart-mqtt/index.js --NETWORK="192.168.1.255" --MQTT_SERVER="mqtt://127.0.0.1" --MQTT_PORT="1883" --MQTT_USERNAME="" --MQTT_PASSWORD="" --MQTT_BASE_TOPIC="ewpe-smart" --DEVICE_POLL_INTERVAL="5000" 
# Required on some systems
WorkingDirectory=/opt/ewpe-smart-mqtt
StandardOutput=inherit
StandardError=inherit
Restart=always
RestartSec=10
User=pi
Group=pi

[Install]
WantedBy=multi-user.target
```

3. Run the servive

- Enable service with `sudo systemctl enable ewpe-smart-mqtt.service`
- Start/stop service with `sudo systemctl start|stop ewpe-smart-mqtt.service`

## Communicating with the bridge

- Publish to `ewpe-smart/devices/list` to receive list of registered devices
- Publish to `ewpe-smart/{deviceId}/get` to receive status of {deviceId}
- Publish to `ewpe-smart/{deviceId}/set` to set status of {deviceId}, payload should be json object with key/values pairs to set, i.e:
```
ewpe-smart/{deviceId}/set {"Pow": 1, "SetTem": 24}
```

Supported features depend on your AC unit, full list can be found [here ](https://github.com/tomikaa87/gree-remote#reading-status-of-a-device)

## Supported devices
All devices which can be controlled via EWPE Smart app should be supported, including:

- Gree Smart series
- Cooper&Hunter: Supreme, Vip Inverter, ICY II, Arctic, Alpha, Alpha NG, Veritas, Veritas NG series
- EcoAir X series
- ProKlima
