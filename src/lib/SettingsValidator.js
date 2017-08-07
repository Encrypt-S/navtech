'use strict'

const config = require('config')
const validator = require('validator')

const Logger = require('./Logger.js')

const globalSettings = config.get('GLOBAL')
const incomingValidation = require('../validators/incoming.validation.json')
const outgoingValidation = require('../validators/outgoing.validation.json')

const NUMBER_TWO_DECIMALS = /^(\d+)?([.]?\d{0,2})?$/

const SettingsValidator = {
  errors: [],
}

SettingsValidator.validateSettings = (options, callback) => {
  SettingsValidator.errors = []
  if (globalSettings.serverType === 'INCOMING') {
    validate(options.settings, options.ignore, incomingValidation)
  } else if (globalSettings.serverType === 'OUTGOING') {
    validate(options.settings, options.ignore, outgoingValidation)
  } else {
    Logger.writeLog('VAL_001', 'invalid server type', { options })
    callback(false)
    return
  }
  if (SettingsValidator.errors.length < 1) {
    callback(true)
  } else {
    Logger.writeLog('VAL_002', 'invalid settings', { errors: SettingsValidator.errors })
    callback(false)
  }
  return
}

function validate(value, ignoreList, validation, currentKey) {
  if (typeof value === 'object' && currentKey !== 'remote') {
    for (const key in validation) {
      if (validation.hasOwnProperty(key)) {
        validate(value[key], ignoreList, validation[key], key)
      }
    }
  } else {
    if (currentKey === 'remote') {
      for (let i = 0; i < value.length; i++) {
        for (const key in validation) {
          if (validation.hasOwnProperty(key)) {
            validate(value[i][key], ignoreList, validation[key], key)
          }
        }
      }
    } else {
      eachField(value, ignoreList, validation, currentKey)
    }
  }
}

function eachField(value, ignoreList, validation, currentKey) {
  if (validation.required === true && !value) {
    SettingsValidator.errors.push('VALUE_IS_REQUIRED for ' + currentKey, value)
    return
  }
  if (validation.required === false && (!value || value === undefined)) {
    return
  }

  if (typeof validation.required === 'object' && validation.required.conditional) {
    const conditional = validation.required.conditional.split('.')
    if (conditional[0] === 'GLOBAL') {
      const conditionMet = globalSettings[conditional[1]]
      if (!conditionMet) return
    }
  }

  if (!value || value === undefined) {
    SettingsValidator.errors.push('MISSING_VALUE for ' + currentKey + ', must provide a valid value')
    return
  }

  if (ignoreList && ignoreList.indexOf(currentKey) !== -1) {
    return
  }

  switch (validation.type) {
    case 'DOMAIN':
      validateDomain(value, validation, currentKey)
      break
    case 'IP_ADDRESS':
      validateIpAddress(value, validation, currentKey)
      break
    case 'PORT':
      validatePort(value, validation, currentKey)
      break
    case 'INT':
      validateInt(value, validation, currentKey)
      break
    case 'FLOAT':
      validateFloat(value, validation, currentKey)
      break
    case 'EMAIL':
      validateEmail(value, validation, currentKey)
      break
    case 'NAV_ADDRESS':
      validateNavAddress(value, validation, currentKey)
      break
    case 'STRING':
      validateString(value, validation, currentKey)
      break
    case 'VALUE':
      validateValue(value, validation, currentKey)
      break
    default:
      SettingsValidator.errors.push('NO_VALIDATION_SET for ' + currentKey)
  }
}

function validateDomain(value, validation, key) {
  if (!validator.isFQDN(value)) {
    SettingsValidator.errors.push('INVALID_DOMAIN for ' + key + ', must be a valid fully qualified domain name')
    return false
  }
  return true
}

function validateIpAddress(value, validation, key) {
  if (!validator.isIP(value)) {
    SettingsValidator.errors.push('INVALID_IP_ADDRESS for ' + key + ', must be a valid IP Address')
    return true
  }
  return true
}

function validatePort(value, validation, key) {
  const integer = parseInt(value, 10)
  if (integer < 1 || integer > 65535) {
    SettingsValidator.errors.push('PORT_OUT_OF_RANGE for ' + key + ', must be between 1 and 65535 ')
    return true
  }
  return false
}

function validateInt(value, validation, key) {
  const integer = parseInt(value, 10)
  if (validation.min && integer < validation.min) {
    SettingsValidator.errors.push('INT_TOO_SMALL for ' + key + ', must be bigger than ' + validation.min)
    return false
  }
  if (validation.max && integer > validation.max) {
    SettingsValidator.errors.push('INT_TOO_LARGE for ' + key + ', must be smaller than ' + validation.max)
    return false
  }
  return true
}

function validateFloat(value, validation, key) {
  const float = parseFloat(value)
  if (validation.min && float < validation.min) {
    SettingsValidator.errors.push('FLOAT_TOO_SMALL for ' + key + ', must be bigger than ' + validation.min)
    return false
  }
  if (validation.max && float > validation.max) {
    SettingsValidator.errors.push('FLOAT_TOO_LARGE for ' + key + ', must be smaller than ' + validation.max)
    return false
  }
  if (validation.decimals && validation.decimals === 2) {
    const correctFormat = value.toString().search(NUMBER_TWO_DECIMALS) >= 0
    if (!correctFormat) {
      SettingsValidator.errors.push('FLOAT_INCORRECT_FORMAT for ' + key + ', must have a maximum of 2 decimal places ')
      return false
    }
  }
  return true
}

function validateEmail(value, validation, key) {
  if (!validator.isEmail(value)) {
    SettingsValidator.errors.push('INVALID_DOMAIN for ' + key + ', must be a valid fully qualified domain name')
    return false
  }
  return true
}

function validateNavAddress(value, validation, key) {
  if (value.length !== 34 && value.charAt(0) !== 'N') {
    SettingsValidator.errors.push('INVALID_NAV_ADDRESSS for ' + key + ', must be 34 characters and starting with N')
    return false
  }
  return true
}

function validateString(value, validation, key) {
  if (validation.length && value.length !== validation.length) {
    SettingsValidator.errors.push(
      'INCORRECT_LENGTH for ' + key + ', must be ' + validation.length + ' characters' + value.length + ' provided'
    )
    return false
  }
  return true
}

function validateValue(value, validation, key) {
  if (value !== validation.value) {
    SettingsValidator.errors.push('INCORRECT_VALUE for ' + key + ', must equal ' + validation.value)
    return false
  }
  return true
}

module.exports = SettingsValidator
