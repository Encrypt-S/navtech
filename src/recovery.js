'use strict'

const Client = require('bitcoin-core')
const config = require('config')

const SettingsValidator = require('./lib/SettingsValidator.js')
const NavCoin = require('./lib/NavCoin.js')
const EncryptedData = require('./lib/EncryptedData.js')
const privateSettings = require('./settings/private.settings')
const recoverySettings = require('./settings/recovery.settings')

const globalSettings = config.get('GLOBAL')

let settings = false
if (globalSettings.serverType === 'INCOMING') settings = config.get('INCOMING')
if (globalSettings.serverType === 'OUTGOING') settings = config.get('OUTGOING')

// -------------- INIT SETTINGS AND DAEMONS ------------------------------------

let subClient

const runtime = {
  decrypted: [],
}

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
  subClient = new Client({
    username: settings.subChain.user,
    password: settings.subChain.pass,
    port: settings.subChain.port,
    host: settings.subChain.host,
  })
  if (recoverySettings.type === 'SUB') {
    getSubchainTransactions()
  } else {
    getNavTransactions()
  }
}

function getSubchainTransactions() {
  subClient.listUnspent(recoverySettings.minconfs, recoverySettings.maxconfs).then((unspent) => {
    NavCoin.filterUnspent({
      unspent,
      client: subClient,
      accountName: privateSettings.account[globalSettings.serverType],
    },
    processFiltered)
  }).catch((err) => {
    console.log('ERROR: failed subClient.listunspent', err)
  })
}

function processFiltered(success, data) {
  if (!success) {
    console.log('ERROR: failed to filter unspent')
    return
  }

  if (!data.currentPending) {
    console.log('FINISHED: No transactions for recovery')
    return
  }

  runtime.currentPending = data.currentPending
  console.log(runtime.currentPending)

  getTxData()
}

function getTxData() {
  EncryptedData.getEncrypted({
    transaction: runtime.currentPending[0],
    client: subClient,
  }, checkDecrypted)
}

function checkDecrypted(success, data) {
  runtime.decrypted.push(data)
  if (runtime.currentPending.length > 1) {
    runtime.currentPending.splice(0, 1)
    getTxData()
  } else {
    console.log('FINISHED')
    console.log(runtime.decrypted)
  }
}

function getNavTransactions() {
  console.log('type NAV not used yet')
}
