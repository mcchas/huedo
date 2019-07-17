# huecho

huecho is a generic module that enables Amazon's echo to communicate with your code. 

It does this by simulating Philips Hue lights, which are natively supported by the echo. 
All network communication happens on the local network, so huecho doesn't have to be accessible from the internet.

This can replace unmaintained modules such as fauxmojs and also providing support for dimming.

This project is largely based on [pimatic-echo](https://github.com/michbeck100/pimatic-echo/).

#### Commands

Supports switching on, off and dimming.

Some the commands are 

* *Alexa, turn on living room*
* *Alexa, switch off living room*
* *Alexa, dim living room to 50 percent*
* *Alexa, turn on Thermostat*

#### Configuration
The configuration of pimatic can be extended by adding an attribute called "echo" on every supported device.

Example:

```javascript

const huecho = require('huecho')

var devices = [
    { 
        id: "light1",
        class: "MySwitch",
        name: "Kitchen Light 1",
        brightness: 50,
        dimlevel: 40,
        handler: (action, cb) => {
            console.log('got state 1', action)
            cb(true)
        }
    },
    { 
        id: "light2",
        class: "MySwitch",
        name: "Kitchen Light 2",
        brightness: 50,
        dimlevel: 40,
        handler: (action, cb) => {
            console.log('got state 2', action)
            cb(true)
        }
    }
]

let echo = new huecho()
echo.init(devices)


```


### Frequently Asked Questions
 
- [Alexa doesn't find any devices. What's wrong?](#Alexa-doesnt-find-any-devices-whats-wrong)

##### Alexa doesn't find any devices. What's wrong?

* IMPORTANT: Currently the newer echo devices (echo plus and echo 2nd gen) are not supported with pimatic-echo. Just the echo dot (2nd gen) or echo (1st gen) are supported. If you are using both generations, you can search for devices with the old echo, but still control everything from all echoes.

