class Emulator {

  changeStateTo(device, state, buttonId) {
    if (state) {
      return this._turnOn(device, buttonId);
    } else {
      return this._turnOff(device);
    }
  }

  getDiscoveryResponses() {
    return [];
  }

  isSupported(device) {
    return false;
  }

  _turnOn(device, buttonId) {
    throw new Error("turnOn must be overridden");
  }

  _turnOff(device) {
    throw new Error("turnOff must be overridden");
  }

  _getState(device) {
    throw new Error("getState must be overridden");
  }

};

module.exports = Emulator