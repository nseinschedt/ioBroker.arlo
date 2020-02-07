'use strict'

const utils = require('@iobroker/adapter-core')
const Request = require('request')
const Arlo = require('node-arlo')
const ArloConstants = require('node-arlo/lib/ArloConstants')

let adapter

function startAdapter(options) {
    options = options || {}
    Object.assign(options, {
        name: 'arlo',

        stateChange: function(id, state) {
            const idParts = id.split('.')
            const action = idParts.pop()
            const deviceId = idParts.pop()
            adapter.log.info(id)
            let callback = null
            if(action === 'snapshot' && state.val) {
                callback = device => {
                    device.on(ArloConstants.FF_SNAPSHOT_AVAILABLE, url => {
                        adapter.setState(deviceId + '.lastSnapshot', url)
                        adapter.setState(deviceId + '.lastSnapshotDate', (new Date()).toISOString())
                        logout(arlo)
                    })
                    arlo.getSnapshot(device.device)
                }
            } else if(action === 'stream' && state.val) {
                callback = device => {
                    arlo.getStream(device.device, url => {
                        adapter.setState(deviceId + '.lastStream', url)
                        adapter.setState(deviceId + '.lastStreamDate', (new Date()).toISOString())
                        logout(arlo)
                    })
                }
            }
            if(!callback) {
                return
            }
            const arlo = new Arlo()
            arlo.login(adapter.config.username, adapter.config.password)
            arlo.on(ArloConstants.EVENT_GOT_DEVICES, deviceList => {
                callback(deviceList[deviceId])
            })
        },

        ready() {
            if(adapter.config.username && adapter.config.password) {
                const arlo = new Arlo()
                arlo.login(adapter.config.username, adapter.config.password)
                arlo.on(ArloConstants.EVENT_GOT_DEVICES, deviceList => {
                    const baseStations = []
                    const devices = Object.values(deviceList)
                    devices
                        .filter(device => device.getType() === ArloConstants.TYPE_BASESTATION)
                        .forEach(device => {
                            baseStations[device.getSerialNumber()] = device
                            adapter.setObject(device.getSerialNumber(), {
                                type: 'device',
                                common: {name: device.getType() + ' - ' + device.getName()},
                                native: {}
                            })
                        })5
                    devices
                        .filter(device => device.getType() === ArloConstants.TYPE_CAMERA || device.getType() === ArloConstants.TYPE_ARLOQS)
                        .forEach(device => {
                            const parent = baseStations[device.device.parentId]
                            adapter.setObject(device.getSerialNumber(), {
                                type: 'device',
                                common: {name: device.getType() + ' - ' + device.getName() + (parent ? ' (' + parent.getName() + ')': '')},
                                native: {}
                            })
                            adapter.setObject(device.getSerialNumber() + '.' + 'snapshot', {
                                type: 'state',
                                common: {
                                    name: 'Snapshot',
                                    type: 'boolean',
                                    role: 'button',
                                    read: false,
                                    write: true,
                                    def: false
                                },
                                native: {}
                            })
                            adapter.setObject(device.getSerialNumber() + '.' + 'lastSnapshot', {
                                type: 'state',
                                common: {
                                    name: 'LastSnapshot',
                                    type: 'state',
                                    role: 'state',
                                    read: true,
                                    write: true,
                                },
                                native: {}
                            })
                            adapter.setObject(device.getSerialNumber() + '.' + 'lastSnapshotDate', {
                                type: 'state',
                                common: {
                                    name: 'LastSnapshotDate',
                                    type: 'state',
                                    role: 'state',
                                    read: true,
                                    write: true,
                                },
                                native: {}
                            })
                            adapter.setObject(device.getSerialNumber() + '.' + 'stream', {
                                type: 'state',
                                common: {
                                    name: 'Stream',
                                    type: 'boolean',
                                    role: 'button',
                                    read: false,
                                    write: true,
                                    def: false
                                },
                                native: {}
                            })
                            adapter.setObject(device.getSerialNumber() + '.' + 'lastStream', {
                                type: 'state',
                                common: {
                                    name: 'LastStream',
                                    type: 'state',
                                    role: 'state',
                                    read: true,
                                    write: true,
                                },
                                native: {}
                            })
                            adapter.setObject(device.getSerialNumber() + '.' + 'lastStreamDate', {
                                type: 'state',
                                common: {
                                    name: 'LastStreamDate',
                                    type: 'state',
                                    role: 'state',
                                    read: true,
                                    write: true,
                                },
                                native: {}
                            })
                        })
                    logout(arlo)
                })
                adapter.subscribeStates('*')
                adapter.setState('info.connection', true, true)
            } else {
                adapter.log.error('Please configure the arlo adapter')
            }

        }
    })

    adapter = new utils.Adapter(options)
    return adapter
}

function logout(arlo) {
    Request(
        {
            url: ArloConstants.WEB.CLIENT + '/unsubscribe',
            method: 'GET',
            json: true,
            jar: true,
            headers: arlo.headers
        },
        () => {}
    )
    Request(
        {
            url: ArloConstants.WEB.CLIENT.replace('/client', '') + '/logout',
            method: 'PUT',
            json: true,
            jar: true,
            headers: arlo.headers
        },
        () => {}
    )
}

if(module && module.parent) {
    module.exports = startAdapter
} else {
    startAdapter()
}
