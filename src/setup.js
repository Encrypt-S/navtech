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
    host: settings.navCoin.host || setings.navCoin.ip,
  })

  subClient = new Client({
    username: settings.subChain.user,
    password: settings.subChain.pass,
    port: settings.subChain.port,
    host: settings.subChain.host || settings.subChain.ip,
  })
  if (globalSettings.encryptedWallet === false) {
    createKeyPair()
    return
  }
  unlockNavWallet()
}

// -------------- MAIN FUNCTIONS -----------------------------------------------

function unlockNavWallet() {
  navClient.walletPassphrase(settings.navCoin.walletPassphrase, 600).then(() => {
    console.log('STATUS: nav wallet unlock successful')
    unlockSubWallet()
  }).catch((err) => {
    switch (err.code) {
      case -15:
        encryptWallet()
        break
      case -17:
        navClient.walletLock().then(() => {
          unlockNavWallet()
        }).catch(() => {
          console.log('ERROR: failed navClient.walletPassphrase', err)
        })
        break
      default:
        console.log('ERROR: failed navClient.walletPassphrase', err)
    }
  })
}

const encryptWallet = () => {
  navClient.encryptWallet(settings.navCoin.walletPassphrase).then(() => {
    console.log('STATUS: nav wallet encrypted with passphrase "' + settings.navCoin.walletPassphrase + '"')
    console.log('SUCCESS: please restart navcoind and re-run this script')
  }).catch((err) => {
    console.log('ERROR: failed navClient.encryptWallet', err)
  })
}

const unlockSubWallet = () => {
  subClient.walletPassphrase(settings.subChain.walletPassphrase, 600).then(() => {
    console.log('STATUS: sub wallet unlock successful')
    createKeyPair()
  }).catch((err) => {
    switch (err.code) {
      case -15:
        encryptSubChainWallet()
        break
      case -17:
        subClient.walletLock().then(() => {
          unlockSubWallet()
        }).catch((err1) => {
          console.log('ERROR: failed subClient.walletLock', err1)
        })
        break
      default:
        console.log('ERROR: failed subClient.walletPassphrase', err)
    }
  })
}

const encryptSubChainWallet = () => {
  subClient.encryptWallet(settings.subChain.walletPassphrase).then(() => {
    console.log('STATUS: sub wallet encrypted with passphrase "' + settings.subChain.walletPassphrase + '"')
    console.log('SUCCESS: please restart subchaind and re-run this script')
  }).catch((err) => {
    console.log('ERROR: failed subClient.encryptWallet', err)
  })
}


function createKeyPair() {
  const date = new Date()
  const today = EncryptionKeys.getMidnight(date)
  const privKeyFile = privateSettings.keyFolders.private.path + today + privateSettings.keyFolders.private.suffix
  const pubKeyFile = privateSettings.keyFolders.public.path + today + privateSettings.keyFolders.public.suffix

  fs.exists(privKeyFile, (privExists) => {
    fs.exists(pubKeyFile, (pubExists) => {
      if (!privExists || !pubExists) {
        generateKeys(privKeyFile, pubKeyFile)
      } else {
        testKeyPair(privKeyFile, pubKeyFile)
      }
    })
  })
}

const generateKeys = (privKeyFile, pubKeyFile) => {
  const encryptionBits = privateSettings.encryptionStrength[globalSettings.serverType]
  const key = new ursa.generatePrivateKey(encryptionBits, 65537)
  const privkey = key.toPrivatePem().toString('ascii')
  const pubkey = key.toPublicPem().toString('ascii')
  fs.writeFile(privKeyFile, privkey, (err1) => {
    if (err1) {
      console.log('ERROR: write privKeyFile failed ' + err1)
    } else {
      fs.writeFile(pubKeyFile, pubkey, (err2) => {
        if (err2) {
          console.log('ERROR: write pubKeyFile failed ' + err2)
        } else {
          console.log('STATUS: RSA keypairs created')
          testKeyPair(privKeyFile, pubKeyFile)
        }
      })
    }
  })
}

const testKeyPair = (privKeyFile, pubKeyFile) => {
  try {
    const dataToEncrypt = {
      a: 'NWMZ2atWCbUnVDKgmPHeTbGLmMUXZxZ3J3',
      n: '999999.99999999',
      s: '123456789012345678901234567890123456789012',
    }
    const crt = ursa.createPublicKey(fs.readFileSync(pubKeyFile))
    const encrypted = crt.encrypt(JSON.stringify(dataToEncrypt), 'utf8', 'base64', ursa.RSA_PKCS1_PADDING)
    const key = ursa.createPrivateKey(fs.readFileSync(privKeyFile))
    const decrypted = key.decrypt(encrypted, 'base64', 'utf8', ursa.RSA_PKCS1_PADDING)
    if (decrypted === JSON.stringify(dataToEncrypt)) {
      console.log('STATUS: encryption test passed', JSON.stringify(dataToEncrypt))
      generateNavAddresses()
    } else {
      console.log('ERROR: failed to decrypt', dataToEncrypt, encrypted, decrypted)
    }
  } catch (err) {
    console.log('ERROR: failed to encrypt', err)
  }
}

// -------------- GENERATE ADDRESS BANKS ---------------------------------------

const generateNavAddresses = () => {
  AddressGenerator.generate({
    accountName: privateSettings.account[globalSettings.serverType],
    client: navClient,
    maxAddresses: privateSettings.maxAddresses,
  }, generateSubAddresses)
}

const generateSubAddresses = (navSuccess) => {
  if (!navSuccess) {
    console.log('ERROR: failed to generate nav addresses')
    Logger.writeLog('002', 'failed to generate nav addresses')
    return
  }
  AddressGenerator.generate({
    accountName: privateSettings.account[globalSettings.serverType],
    client: subClient,
    maxAddresses: privateSettings.maxAddresses,
  }, generateHoldingAddresses)
}

const generateHoldingAddresses = (subSuccess) => {
  if (!subSuccess) {
    console.log('ERROR: failed to generate sub addresses')
    Logger.writeLog('002', 'failed to generate sub addresses')
    return
  }
  if (globalSettings.serverType === 'INCOMING') {
    AddressGenerator.generate({
      accountName: privateSettings.account.HOLDING,
      client: navClient,
      maxAddresses: privateSettings.maxHolding,
    }, createSecret)
  } else {
    AddressGenerator.generate({
      accountName: privateSettings.account.HOLDING,
      client: subClient,
      maxAddresses: privateSettings.maxHolding,
    }, createSecret)
  }
}

const createSecret = (holdingSuccess) => {
  if (!holdingSuccess) {
    console.log('ERROR: failed to generate holding nav addresses')
    Logger.writeLog('002', 'failed to generate holding nav addresses')
    return
  }

  if (globalSettings.serverType === 'INCOMING') {
    bcrypt.hash(settings.secretOptions.salt, settings.secretOptions.saltRounds, (err, hash) => {
      console.log('STATUS: genearted secret: ', hash.substring(0, 32))
      console.log('SUCCESS: everything is configured')
    })
  } else {
    console.log('SUCCESS: everything is configured')
  }
}
