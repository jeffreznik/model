import validatejs from 'validate.js'
import { GeneralError, ValidationError } from '@jeffreznik/error'

validatejs.async.options = {fullMessages: false}
validatejs.validators.email.PATTERN = new RegExp('^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$', 'i')
validatejs.validators.array = value => {
  return new validatejs.Promise(resolve => {
    if (validatejs.isArray(value))
      resolve()
    else
      resolve('is not an array')
  })
}

// default values for schema property options
const getDescriptor = (attributeName, descriptor) => {
  return Object.assign({}, {
    defaultValue: null,
    enumerable: true,
    get() {
      return this.attributes[attributeName]
    },
    set(value) {
      this.attributes[attributeName] = value
    },
    validators: {},
    writable: false,
  }, descriptor)
}

class Model {
  constructor(modelClass, attributes, repository) {
    Object.defineProperty(this, 'modelClass', { value: modelClass })
    Object.defineProperty(this, 'attributes', { value: {} })
    Object.defineProperty(this, 'errors',     { value: {}, writable: true })
    Object.defineProperty(this, 'repository', { value: repository })

    modelClass.attributeNames.forEach(attributeName => {
      const descriptor = modelClass.schema[attributeName]
      Object.defineProperty(this, attributeName, {
        enumerable: descriptor.enumerable,
        get: descriptor.get.bind(this),
        set: descriptor.set.bind(this),
      })

      if (typeof attributes[attributeName] === 'undefined' || attributes[attributeName] === null) {
        this.attributes[attributeName] = modelClass.defaultAttributes[attributeName]
      } else {
        this.attributes[attributeName] = attributes[attributeName]
      }
    })
  }

  static createModel(modelClass, schema) {
    Object.defineProperty(modelClass, 'attributeNames', { value: Object.keys(schema) })
    Object.defineProperty(modelClass, 'schema', {
      value: modelClass.attributeNames.reduce((mergedSchema, attributeName) => {
        mergedSchema[attributeName] = getDescriptor(attributeName, schema[attributeName])
        return mergedSchema
      }, {})
    })
    Object.defineProperty(modelClass, 'validators', {
      value: modelClass.attributeNames.reduce((validators, attributeName) => {
        if (schema[attributeName].validators) {
          validators[attributeName] = schema[attributeName].validators
        }
        return validators
      }, {})
    })
    Object.defineProperty(modelClass, 'defaultAttributes', {
      value: modelClass.attributeNames.reduce((defaultAttributes, attributeName) => {
        if (typeof modelClass.schema[attributeName].defaultValue === 'undefined') {
          defaultAttributes[attributeName] = null
        } else {
          defaultAttributes[attributeName] = modelClass.schema[attributeName].defaultValue
        }
        return defaultAttributes
      }, {})
    })
    Object.defineProperty(modelClass, 'writableAttributes', {
      value: modelClass.attributeNames.filter(attributeName => schema[attributeName].writable === true)
    })
    return modelClass
  }

  async validate() {
    try {
      return await validatejs.async(this.attributes, this.modelClass.validators)
    } catch (errors) {
      this.errors = errors
      throw new ValidationError(`validation failure in model of class ${this.modelClass.name}: ${errors}`, null, errors)
    }
  }

  async save() {
    await this.validate()
    return Object.assign(this, await this.repository.save(this))
  }
}

export default Model
