const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const path = require('path');
// const Promise = require('bluebird');


var winston = require('winston')



const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.prettyPrint(),
        winston.format.colorize(),
        winston.format.printf(info => `${info.timestamp} [${info.level}]: ${info.message}`)
      ),
    level: 'silly',
    transports: [
      new winston.transports.Console(),
    //   new winston.transports.File({ filename: 'combined.log' })
    ]
  });

var env = { logger: logger }

class EchoPlugin {

  constructor() {

    this.UpnpServer = require('./lib/upnp')
    this.HueEmulator = require('./lib/hue')
    this.ipAddress
    this.macAddress
    this.serverPort
    this.upnpPort
    this.storageDir
  }

  init(devices) {

    env.logger.info("Starting huecho...")

    let networkInfo = this._getNetworkInfo();
    if (networkInfo === null && (!this.ipAddress || !this.macAddress)) {
      throw new Error("Unable to obtain network information.", +" Please provide ip and mac address in plugin config!")
    }

    let ipAddress = this.ipAddress ? this.ipAddress : networkInfo.address;
    let macAddress = this.macAddress ? this.macAddress : networkInfo.mac;
    let serverPort = this.serverPort ? this.serverPort : 51080
    let upnpPort = this.upnpPort ? this.upnpPort : 1900;

    let storageDir = path.resolve(this.storageDir || './echo-database');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir);
    }

    let upnpServer = new this.UpnpServer(ipAddress, serverPort, macAddress, upnpPort);
    let hueEmulator = new this.HueEmulator(ipAddress, serverPort, macAddress, upnpPort, this.config, storageDir, env);

    env.logger.debug(`Using ip address : ${ipAddress}`);

    devices.forEach(device => {

      let addDevice = hueEmulator.addDevice(device);

      if (device.template === 'buttons') {
        let ref = device.config.buttons;
        let results = [];
        ref.forEach(button => {
          results.push(addDevice(button.text, button.id));
        })
        return results;
      } 
      else {
        addDevice(this._getDeviceName(device));
        let ref1 = this._getAdditionalNames(device);
        let results1 = [];
        ref1.forEach(additionalName => {
          results1.push(addDevice(additionalName))
        })
        return results1;
      }

    })

    upnpServer.start();
    let server = this._startServer(ipAddress, serverPort);
    hueEmulator.start(server);

    env.logger.debug("Pairing mode is enabled for 20 seconds. Let Alexa scan for devices now.");
    hueEmulator.pairingEnabled = true;
    // return Promise.delay(20000).then(() => {
    //   return hueEmulator.pairingEnabled = false;
    // }).then(() => {
    //     env.logger.debug("Pairing mode is disabled again.");
    //     return
    // });
    return new Promise(resolve => setTimeout(() => {
      env.logger.debug("Pairing mode is disabled again.");
      hueEmulator.pairingEnabled = false;
      resolve
    },40000))
  }

  _getDeviceName(device) {
    return device.name;
  }

  _getAdditionalNames(device) {
    return [];
  }

  _getNetworkInfo() {
    var addrInfo, i, ifaceDetails, ifaceName, len, networkInterfaces;
    networkInterfaces = require('os').networkInterfaces();
    for (ifaceName in networkInterfaces) {
      ifaceDetails = networkInterfaces[ifaceName];
      for (i = 0, len = ifaceDetails.length; i < len; i++) {
        addrInfo = ifaceDetails[i];
        if (addrInfo.family === 'IPv4' && !addrInfo.internal) {
          return addrInfo;
        }
      }
    }
    env.logger.warn("No network interface found.");
    return null;
  }

  _startServer(address, serverPort) {
    var emulator = express();
    emulator.listen(serverPort, address, () => {
      return env.logger.info(`started hue emulator on port ${serverPort}`);
    }).on('error', () => {
      throw new Error(`Error starting hue emulator. Maybe port ${serverPort} is not available?`);
    });
    emulator.use(bodyParser.json({
      type: "application/x-www-form-urlencoded",
      limit: '1mb'
    }));
    emulator.use(bodyParser.json({
      limit: '1mb'
    }));
    return emulator;
  }


}

module.exports = EchoPlugin
