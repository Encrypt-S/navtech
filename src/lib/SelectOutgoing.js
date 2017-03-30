const lodash = require('lodash')
const request = require('request')
const ursa = require('ursa')
const fs = require('fs')

const privateSettings = require('../settings/private.settings.json')
const Logger = require('./Logger.js')
const NavCoin = require('./NavCoin.js')
const EncryptionKeys = require('./EncryptionKeys.js')

const SelectOutgoing = {}

SelectOutgoing.run = (options, callback) => {
  const required = ['settings', 'navClient']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('SEL_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to SelectOutgoing.run' })
    return
  }
  SelectOutgoing.runtime = {
    callback,
    remoteCluster: JSON.parse(JSON.stringify(options.settings.remote)),
    settings: options.settings,
    navClient: options.navClient,
  }

  if (!SelectOutgoing.runtime.remoteCluster || SelectOutgoing.runtime.remoteCluster.length < 1) {
    Logger.writeLog('SEL_002', 'no remote servers detected', { remoteCluster: SelectOutgoing.runtime.remoteCluster })
    SelectOutgoing.runtime.callback(false, { message: 'no remote servers detected' })
    return
  }
  SelectOutgoing.pickServer()
}

SelectOutgoing.pickServer = () => {
  if (SelectOutgoing.runtime.remoteCluster.length < 1) {
    Logger.writeLog('SEL_003', 'no valid outgoing servers found')
    SelectOutgoing.runtime.callback(false, { returnAllToSenders: true })
    return
  }

  const randomIndex = Math.floor(Math.random() * SelectOutgoing.runtime.remoteCluster.length)
  SelectOutgoing.runtime.chosenOutgoingIndex = randomIndex
  SelectOutgoing.runtime.chosenOutgoing = SelectOutgoing.runtime.remoteCluster[randomIndex]
  SelectOutgoing.testOutgoing(SelectOutgoing.runtime.remoteCluster[randomIndex])
}

SelectOutgoing.testOutgoing = (chosenOutgoing) => {
  const outgoingHost = chosenOutgoing.host ? chosenOutgoing.host : chosenOutgoing.ipAddress
  const outgoingAddress = chosenOutgoing.port ? outgoingHost + ':' + chosenOutgoing.port : outgoingHost
  const options = {
    uri: 'https://' + outgoingAddress + '/api/check-node',
    method: 'POST',
    timeout: 60000,
    rejectUnauthorized: false,
    requestCert: true,
    agent: false,
    form: {
      server_type: 'OUTGOING',
      num_addresses: 6,
    },
  }

  request(options, (err, response, body) => {
    if (err) {
      Logger.writeLog('SEL_004', 'failed to query outgoing server', { body, outgoingAddress, error: err })
      SelectOutgoing.runtime.remoteCluster.splice(SelectOutgoing.runtime.chosenOutgoingIndex, 1)
      SelectOutgoing.pickServer()
      return
    }
    SelectOutgoing.checkOutgoingCanTransact(body, outgoingAddress)
  })
}

SelectOutgoing.checkOutgoingCanTransact = (body, outgoingAddress) => {
  const bodyJson = JSON.parse(body) // @TODO try catch around this
  if (bodyJson.type !== 'SUCCESS') {
    Logger.writeLog('SEL_005', 'outgoing server returned failure', { body: bodyJson, outgoingAddress })
    SelectOutgoing.runtime.remoteCluster.splice(SelectOutgoing.runtime.chosenOutgoingIndex, 1)
    SelectOutgoing.pickServer()
    return
  }

  if (!bodyJson.data || !bodyJson.data.nav_addresses || !bodyJson.data.nav_balance || !bodyJson.data.public_key) {
    Logger.writeLog('SEL_006', 'outgoing server returned incorrect params', { body: bodyJson, outgoingAddress })
    SelectOutgoing.runtime.remoteCluster.splice(SelectOutgoing.runtime.chosenOutgoingIndex, 1)
    SelectOutgoing.pickServer()
    return
  }

  SelectOutgoing.runtime.outgoingServerData = bodyJson.data
  SelectOutgoing.runtime.outgoingNavBalance = bodyJson.data.nav_balance

  if (SelectOutgoing.runtime.outgoingServerData.server_type !== 'OUTGOING') {
    Logger.writeLog('SEL_007', 'outgoing server is of the wrong type', { body: SelectOutgoing.runtime.outgoingServerData })
    SelectOutgoing.runtime.remoteCluster.splice(SelectOutgoing.runtime.chosenOutgoingIndex, 1)
    SelectOutgoing.pickServer()
    return
  }
  SelectOutgoing.checkPublicKey()
}

SelectOutgoing.checkPublicKey = () => {
  try {
    const dataToEncrypt = {
      a: 'NWMZ2atWCbUnVDKgmPHeTbGLmMUXZxZ3J3',
      n: '9999.99999999',
      s: SelectOutgoing.runtime.settings.secret,
    }
    SelectOutgoing.runtime.outgoingPubKey = ursa.createPublicKey(SelectOutgoing.runtime.outgoingServerData.public_key)
    const encrypted = SelectOutgoing.runtime.outgoingPubKey.encrypt(JSON.stringify(dataToEncrypt), 'utf8', 'base64', ursa.RSA_PKCS1_PADDING)
    if (!encrypted || encrypted.length !== privateSettings.encryptionOutput.OUTGOING) {
      Logger.writeLog('SEL_008', 'failed to encrypt test data', { encrypted })
      SelectOutgoing.runtime.remoteCluster.splice(SelectOutgoing.runtime.chosenOutgoingIndex, 1)
      SelectOutgoing.pickServer()
      return
    }
    SelectOutgoing.hasNavAddresses()
  } catch (err) {
    Logger.writeLog('SEL_009', 'bad public key provided by outgoing server', {
      error: err,
      body: SelectOutgoing.runtime.outgoingServerData,
    })
    SelectOutgoing.runtime.remoteCluster.splice(SelectOutgoing.runtime.chosenOutgoingIndex, 1)
    SelectOutgoing.pickServer()
  }
}

SelectOutgoing.hasNavAddresses = () => {
  if (SelectOutgoing.runtime.outgoingServerData.nav_addresses.length < 1) {
    Logger.writeLog('SEL_010', 'outgoing server did not provide at least 1 address', {
      body: SelectOutgoing.runtime.outgoingServerData,
    })
    SelectOutgoing.runtime.remoteCluster.splice(SelectOutgoing.runtime.chosenOutgoingIndex, 1)
    SelectOutgoing.pickServer()
    return
  }
  NavCoin.validateAddresses({
    client: SelectOutgoing.runtime.navClient,
    addresses: SelectOutgoing.runtime.outgoingServerData.nav_addresses,
  }, SelectOutgoing.navAddressesValid)
}

SelectOutgoing.navAddressesValid = (addressesValid) => {
  if (!addressesValid) {
    Logger.writeLog('SEL_011', 'invalid nav addresses sent from the outgoing server', { addressesValid })
    SelectOutgoing.runtime.remoteCluster.splice(SelectOutgoing.runtime.chosenOutgoingIndex, 1)
    SelectOutgoing.pickServer()
    return
  }
  EncryptionKeys.getEncryptionKeys({}, SelectOutgoing.encryptOutgoingAddresses)
}

SelectOutgoing.encryptOutgoingAddresses = (success, data) => {
  if (!success || !data || !data.privKeyFile || !data.pubKeyFile) {
    Logger.writeLog('SEL_012', 'failed to get the current keys', { success, data })
    SelectOutgoing.runtime.callback(false, { returnAllToSenders: true })
  }
  try {
    const crt = ursa.createPublicKey(fs.readFileSync(data.pubKeyFile))
    const encrypted = crt.encrypt(
      JSON.stringify(SelectOutgoing.runtime.outgoingServerData.nav_addresses), 'utf8', 'base64', ursa.RSA_PKCS1_PADDING
    )
    const key = ursa.createPrivateKey(fs.readFileSync(data.privKeyFile))
    const decrypted = key.decrypt(encrypted, 'base64', 'utf8', ursa.RSA_PKCS1_PADDING)
    if (decrypted !== JSON.stringify(SelectOutgoing.runtime.outgoingServerData.nav_addresses)) {
      Logger.writeLog('SEL_013', 'failed to encrypt with local key', { success, data, encrypted, decrypted })
      SelectOutgoing.runtime.callback(false, { returnAllToSenders: true })
      return
    }
    SelectOutgoing.runtime.callback(true, {
      chosenOutgoing: SelectOutgoing.runtime.chosenOutgoing,
      outgoingNavBalance: SelectOutgoing.runtime.outgoingNavBalance,
      outgoingPubKey: SelectOutgoing.runtime.outgoingPubKey,
      holdingEncrypted: encrypted,
      returnAllToSenders: false,
    })
    return
  } catch (err) {
    Logger.writeLog('INC_020', 'failed to use local key', {
      success,
      data,
      error: err,
      encrypting: SelectOutgoing.runtime.outgoingServerData.nav_addresses,
    })
    SelectOutgoing.runtime.callback(false, { returnAllToSenders: true })
  }
}

module.exports = SelectOutgoing
