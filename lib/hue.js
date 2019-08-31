const _ = require('lodash');
const fs = require('fs');
const uuid = require('uuid/v4');
const path = require('path');
let Emulator = require('./emulator');

class Hue extends Emulator {

  constructor(ipAddress, serverPort, macAddress, upnpPort, config, storagePath, env) {
    super();
    this.ipAddress = ipAddress;
    this.serverPort = serverPort;
    this.macAddress = macAddress;
    this.upnpPort = upnpPort;
    this.config = config;
    this.storagePath = storagePath;
    this.users = this._readUsers();

    this.pairingEnabled = false;
    // this.users = [];
    this.devices = {};

    this.logger = env.logger
    
  }

  addDevice(device) {
    if (Object.keys(this.devices).length >= 50) {
      this.logger.warn("Max number of devices exceeded.");
      return function() {};
    }
    return (deviceName, buttonId) => {
      var index, uniqueId;
      index = (Object.keys(this.devices).length + 1).toString();
      uniqueId = ("0" + (Object.keys(this.devices).length + 1).toString(16)).slice(-2).toUpperCase();
      this.devices[index] = {
        index: index,
        state: {
          on: this._getState(device),
          brightness: this._getBrightness(device)
        },
        device: device,
        name: deviceName,
        uniqueId: "00:17:88:5E:D3:" + uniqueId + "-" + uniqueId,
        buttonId: buttonId
      }
      return this.logger.info(`added device ${deviceName} as dimmable light`);
    }
  }

  _changeState(device, state) {

    try {
      state = JSON.parse(Object.keys(state)[0])
    } 
    catch (error) {}


    this.logger.info(`changing state for ${device.name}: ${JSON.stringify(state)}`)
    let that = this

    device.device.handler(state, function(result) {

      that.logger.info(`callback received with state ${result}`)

      if (state.bri != null) {
        that._setBrightness(device.device, state.bri, device.buttonId) //.done();
        device.state.brightness = state.bri;
        return {
          "success": {
            [`/lights/${device.index}/state/bri`]: state.bri
          }
        };
      } else if (state.on != null) {
        that.changeStateTo(device.device, state.on, device.buttonId) //.done();
        device.state.on = state.on;
        return {
          "success": {
            [`/lights/${device.index}/state/on`]: state.on
          }
        };
      } else {
        throw new Error(`unsupported state: ${JSON.stringify(state)}`);
      }
    })
  }

  _turnOn(device, buttonId) {
    this.logger.info(`device ${device.name} on`)
    return null
  }

  _turnOff(device) {
    this.logger.info(`device ${device.name} off`)
    return null
  }

  _getState(device) {
    this.logger.info(`device ${device.name} getState`)
    return true
  }

  _getBrightness(device) {
    this.logger.info(`device ${device.name} getBrightness`)
    return 127
    // brightness = this._getState(device) ? 100.0 : 0.0;
    // return Math.ceil(brightness / 100 * 254);
  }

  _setBrightness(device, dimLevel, buttonId) {
    this.logger.info(`device ${device.name} setBrightness to ${dimLevel}`)
    return null
  }

  _getSNUUIDFromMac() {
    return this.macAddress.replace(/:/g, '').toLowerCase();
  }

  _getHueBridgeIdFromMac() {
    var bridgeId, cleanMac;
    cleanMac = this._getSNUUIDFromMac();
    bridgeId = cleanMac.substring(0, 6).toUpperCase() + 'FFFE' + cleanMac.substring(6).toUpperCase();
    return bridgeId;
  }

  start(emulator) {
    emulator.get('/description.xml', (req, res) => {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      return res.status(200).send(this._getHueTemplate());
    });
    emulator.get('/favicon.ico', (req, res) => {
      return res.status(200).send('');
    });
    emulator.get('/hue_logo_0.png', (req, res) => {
      return res.status(200).send('');
    });
    emulator.get('/hue_logo_3.png', (req, res) => {
      return res.status(200).send('');
    });
    emulator.post('/api', (req, res) => {
      var username;
      res.setHeader("Content-Type", "application/json");
      res.status(200);
      if (this.pairingEnabled) {
        username = this._addUser(req.body.username);
        return res.send(JSON.stringify([
          {
            "success": {
              "username": username
            }
          }
        ]));
      } else {
        return res.send(JSON.stringify({
          "error": {
            "type": 101,
            "address": req.path,
            "description": "Not Authorized. Pair button must be pressed to add users."
          }
        }));
      }
    });
    emulator.get('/api/:userid', (req, res) => {
      var lights;
      if (this._authorizeUser(req.params["userid"], req, res)) {
        res.setHeader("Content-Type", "application/json");
        lights = {};
        _.forOwn(this.devices, (device, id) => {
          return lights[id] = this._getDeviceResponse(device);
        });
        return res.status(200).send(JSON.stringify({lights}));
      }
    });
    emulator.get('/api/:userid/lights', (req, res) => {
      var response;
      if (this._authorizeUser(req.params["userid"], req, res)) {
        response = {};
        _.forOwn(this.devices, (device, id) => {
          return response[id] = this._getDeviceResponse(device);
        });
        res.setHeader("Content-Type", "application/json");
        return res.status(200).send(JSON.stringify(response));
      }
    });
    emulator.get('/api/:userid/lights/:id', (req, res) => {
      var device, deviceId, deviceResponse;
      if (this._authorizeUser(req.params["userid"], req, res)) {
        deviceId = req.params["id"];
        device = this.devices[deviceId];
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        if (device) {
          deviceResponse = JSON.stringify(this._getDeviceResponse(device));
          return res.send(deviceResponse);
        } else {
          this.logger.warn(`device with id ${deviceId} not found`);
          return res.send(JSON.stringify({
            "error": {
              "type": 3,
              "address": req.path,
              "description": `Light ${deviceId} does not exist.`
            }
          }));
        }
      }
    });
    emulator.put('/api/:userid/lights/:id/state', (req, res) => {
      var device, deviceId, response;
      if (this._authorizeUser(req.params["userid"], req, res)) {
        deviceId = req.params["id"];
        device = this.devices[deviceId];
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        if (device) {
          response = this._changeState(device, req.body);
          return res.send(JSON.stringify([response]));
        } else {
          this.logger.warn(`device with id ${deviceId} not found`);
          return res.send(JSON.stringify({
            "error": {
              "type": 3,
              "address": req.path,
              "description": `Light ${deviceId} does not exist.`
            }
          }));
        }
      }
    });
    emulator.get('/api/:userid/groups', (req, res) => {
      res.setHeader("Content-Type", "application/json");
      return res.status(200).send("{}");
    });
    return emulator.get('/api/:userid/groups/:id', (req, res) => {
      var deviceId;
      deviceId = req.params["id"];
      res.setHeader("Content-Type", "application/json");
      return res.status(200).send(JSON.stringify({
        "error": {
          "type": 3,
          "address": req.path,
          "description": `/groups/${deviceId} not available.`
        }
      }));
    });
  }

  _getHueTemplate() {
    var bridgeIdMac, response;
    bridgeIdMac = this._getSNUUIDFromMac();
    response = `<?xml version="1.0" encoding="UTF-8" ?>\n<root xmlns="urn:schemas-upnp-org:device-1-0">\n  <specVersion>\n    <major>1</major>\n    <minor>0</minor>\n  </specVersion>\n  <URLBase>http://${this.ipAddress}:${this.serverPort}/</URLBase>\n  <device>\n    <deviceType>urn:schemas-upnp-org:device:Basic:1</deviceType>\n    <friendlyName>Pimatic Hue bridge</friendlyName>\n    <manufacturer>Royal Philips Electronics</manufacturer>\n    <manufacturerURL>http://www.philips.com</manufacturerURL>\n    <modelDescription>Philips hue Personal Wireless Lighting</modelDescription>\n    <modelName>Philips hue bridge 2015</modelName>\n    <modelNumber>929000226503</modelNumber>\n    <modelURL>http://www.meethue.com</modelURL>\n    <serialNumber>0017880ae670</serialNumber>\n    <UDN>uuid:2f402f80-da50-11e1-9b23-${bridgeIdMac}</UDN>\n    <serviceList>\n      <service>\n        <serviceType>(null)</serviceType>\n        <serviceId>(null)</serviceId>\n        <controlURL>(null)</controlURL>\n        <eventSubURL>(null)</eventSubURL>\n        <SCPDURL>(null)</SCPDURL>\n      </service>\n    </serviceList>\n    <presentationURL>index.html</presentationURL>\n    <iconList>\n      <icon>\n        <mimetype>image/png</mimetype>\n        <height>48</height>\n        <width>48</width>\n        <depth>24</depth>\n        <url>hue_logo_0.png</url>\n      </icon>\n      <icon>\n        <mimetype>image/png</mimetype>\n        <height>120</height>\n        <width>120</width>\n        <depth>24</depth>\n        <url>hue_logo_3.png</url>\n      </icon>\n    </iconList>\n  </device>\n</root>`;
    return response;
  }

  _getDeviceResponse(device) {
    return {
      state: {
        on: device.state.on,
        bri: device.state.brightness,
        alert: "none",
        reachable: true
      },
      type: "Dimmable light",
      name: device.name,
      modelid: "LWB007",
      manufacturername: "huedo",
      uniqueid: device.uniqueId,
      swversion: "66009461"
    };
  }

  _authorizeUser(username, req, res) {
    if (username === "echo") {
      // convenience user to help analyze problems
      return true;
    }
    if (this.pairingEnabled) {
      this._addUser(username);
    }
    if ([].indexOf.call(this.users, username) >= 0) {
      return true;
    } else {
      this.logger.debug(`Pairing is disabled and user ${username} was not found`);
      res.status(401).send(JSON.stringify({
        "error": {
          "type": 1,
          "address": req.path,
          "description": "Not Authorized."
        }
      }));
      return false;
    }
  }

  _addUser(username) {
    if (!username) {
      username = uuid().replace(/-/g, '');
    }
    if ([].indexOf.call(this.users, username) < 0) {
      this.users.push(username);
      fs.appendFileSync(path.resolve(this.storagePath, 'echoUsers'), username + '\n');
      this.logger.debug(`added user ${username}`);
    }
    return username;
  }

  _deleteUser(username) {
    if ([].indexOf.call(this.users, username) >= 0) {
      this.users.splice(users.indexOf(username), 1);
      return fs.writeFileSync(path.resolve(this.storagePath, 'echoUsers'), JSON.stringify(this.users));
    }
  }

  _readUsers() {
    if (fs.existsSync(path.resolve(this.storagePath, 'echoUsers'))) {
      return fs.readFileSync(path.resolve(this.storagePath, 'echoUsers')).toString().split('\n');
    }
    return [];
  }

};

module.exports = Hue
