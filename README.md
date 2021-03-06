# huedo

huedo is a generic module that enables Amazon's echo to communicate with your code. 

It does this by simulating Philips Hue lights, which are natively supported by the echo. 
All network communication happens on the local network, so huedo doesn't have to be accessible from the internet.

This can replace unmaintained modules such as fauxmojs and also providing support for dimming.

This project is largely based on [pimatic-echo](https://github.com/michbeck100/pimatic-echo/).

#### Commands

Supports switching on, off and dimming.

Some the commands are 

* *Alexa, turn on living room*
* *Alexa, switch off living room*
* *Alexa, dim living room to 50 percent*
* *Alexa, turn on Thermostat*

#### Usage

Example:

```javascript

const huedo = require('huedo')

var devices = [
    { 
        id: "light1",
        name: "Light",
        handler: (action, cb) => {
            const value = Math.round(action.bri / 255 * 100)
            console.log(`set light ${action.on} with value ${value}`)
            cb(true)
        }
    },
    { 
        id: "heater1",
        name: "Heater",
        handler: (action, cb) => {
            const value = Math.round(action.bri / 255 * 100)
            console.log(`set heater ${action.on} with value ${value} degrees`)
            cb(true)
        }
    }
]

let echo = new huedo()
echo.init(devices)


```


### Frequently Asked Questions
 
- [Alexa doesn't find any devices. What's wrong?](#Alexa-doesnt-find-any-devices-whats-wrong)

##### Alexa doesn't find any devices. What's wrong?

* IMPORTANT: Currently the newer echo devices (echo plus and echo 2nd gen) are not supported. Just the echo dot (2nd gen) or echo (1st gen) are supported. If you are using both generations, you can search for devices with the old echo, but still control everything from all echoes.

