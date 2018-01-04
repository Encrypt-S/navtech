'use strict'

const Client = require('bitcoin-core')
const bcrypt = require('bcrypt')
const ursa = require('ursa')
const fs = require('fs')
const config = require('config')

const SettingsValidator = require('./lib/SettingsValidator.js')
const AddressGenerator = require('./lib/AddressGenerator.js')
const EncryptionKeys = require('./lib/EncryptionKeys.js')
const Logger = require('./lib/Logger.js')

const privateSettings = require('./settings/private.settings')
const recoverySettings = require('./settings/recovery.settings')

const globalSettings = config.get('GLOBAL')

let settings = false
if (globalSettings.serverType === 'INCOMING') settings = config.get('INCOMING')
if (globalSettings.serverType === 'OUTGOING') settings = config.get('OUTGOING')

// -------------- INIT SETTINGS AND DAEMONS ------------------------------------

let navClient
let subClient

if (settings) {
  SettingsValidator.validateSettings({ settings, ignore: ['secret'] }, canInit)
} else {
  console.log('ERROR: invalid serverType')
}

function canInit(settingsValid) {
  if (settingsValid) {
    initServer()
  } else {
    console.log('ERROR: invalid settings')
  }
}

function initServer() {
  navClient = new Client({
    username: settings.navCoin.user,
    password: settings.navCoin.pass,
    port: settings.navCoin.port,
    host: settings.navCoin.host,
  })

  subClient = new Client({
    username: settings.subChain.user,
    password: settings.subChain.pass,
    port: settings.subChain.port,
    host: settings.subChain.host,
  })
  if (recoverySettings.type === "SUB") {
    getSubchainTransactions()
  } else {
    getNavTransactions()
  }

}

function getSubchainTransactions() {
  console.log(subClient)
  subClient.listunspent(recoverySettings.minconfs, recoverySettings.maxconfs).then((unspent) => {
    console.log(unspent)
  }).catch((err) => {
    console.log('ERROR: failed subClient.listunspent', err)
  })
}

function getNavTransactions() {
  console.log('type NAV not used yet');
}
