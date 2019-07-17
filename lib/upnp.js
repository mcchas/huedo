const async = require('async');
const udpServer = require('dgram').createSocket({type: 'udp4', reuseAddr: true });

class UpnpServer {

  constructor(ipAddress, serverPort, macAddress, upnpPort) {
    this.ipAddress = ipAddress;
    this.serverPort = serverPort;
    this.macAddress = macAddress;
    this.upnpPort = upnpPort;
  }

  start() {
    udpServer.on('error', (err) => {
      // env.logger.error(`server.error:\n${err.message}`);
      return udpServer.close();
    })

    udpServer.on('message', (msg, rinfo) => {
      if (msg.indexOf('M-SEARCH * HTTP/1.1') === 0 && msg.indexOf('ssdp:discover') > 0) {
        if (msg.indexOf('ST: urn:schemas-upnp-org:device:basic:1') > 0 || msg.indexOf('ST: upnp:rootdevice') > 0 || msg.indexOf('ST: ssdp:all') > 0) {
          // env.logger.debug(`<< server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
          return async.eachSeries(this._getDiscoveryResponses(), (response, cb) => {
            return udpServer.send(response, 0, response.length, rinfo.port, rinfo.address, () => {
              // env.logger.debug(`>> sent response ssdp discovery response: ${response}`);
              return cb();
            });
          }, (err) => {
            // env.logger.debug("complete sending all responses.");
            if (err) {
              // return env.logger.warn(`Received error: ${JSON.stringify(err)}`);
              return err
            }
          });
        }
      }
    })

    udpServer.on('listening', () => {
      // let address = udpServer.address();
      // env.logger.debug(`udp server listening on port ${address.port}`);
      return udpServer.addMembership('239.255.255.250');
    })

    return udpServer.bind(this.upnpPort);
  }

  _getDiscoveryResponses() {
    const bridgeId = this._getHueBridgeIdFromMac();
    const bridgeSNUUID = this._getSNUUIDFromMac();
    const uuidPrefix = '2f402f80-da50-11e1-9b23-';
    let responses = [];
    ["upnp:rootdevice", "urn:schemas-upnp-org:device:basic:1", `uuid: ${uuidPrefix}${bridgeSNUUID}`].forEach(st => {
      let template = `HTTP/1.1 200 OK\nHOST: 239.255.255.250:${this.upnpPort}\nEXT:\nCACHE-CONTROL: max-age=100\nLOCATION: http://${this.ipAddress}:${this.serverPort}/description.xml\nSERVER: FreeRTOS/7.4.2, UPnP/1.0, IpBridge/1.19.0\nhue-bridgeid: ${bridgeId}\nST: ${st}\nUSN: uuid:${uuidPrefix}${bridgeSNUUID}::upnp:rootdevice\r\n\r\n`;
      responses.push(new Buffer(template));
    })
    return responses;
  }

  _getSNUUIDFromMac() {
    return this.macAddress.replace(/:/g, '').toLowerCase();
  }

  _getHueBridgeIdFromMac() {
    const cleanMac = this._getSNUUIDFromMac();
    let bridgeId = cleanMac.substring(0, 6).toUpperCase() + 'FFFE' + cleanMac.substring(6).toUpperCase();
    return bridgeId;
  }

}

module.exports = UpnpServer
