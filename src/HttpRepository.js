import { http } from '@jeffreznik/utils'
import HttpStatus from 'http-status-codes'
import { AuthorizationError, HttpError, NotFoundError, ValidationError } from '@jeffreznik/error'

class HttpRepository {
  constructor(modelClass, endpoint) {
    this.modelClass = modelClass
    this.endpoint = endpoint
  }

  async find(attributes, raw = false) {
    try {
      const response = await http.get(this.endpoint, {params: attributes})
      if (raw)
        return response.data
      else
        return response.data.map(obj => new this.modelClass(obj, this))
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === HttpStatus.BAD_REQUEST) {
          throw new ValidationError('invalid search criteria', error)
        }
        if (error.status === HttpStatus.UNAUTHORIZED) {
          throw new AuthorizationError('unauthorized', error)
        }
      }
      throw error.wrap(`unknown error retrieving ${this.modelClass.name} model(s) from repository`)
    }
  }

  async findAll(raw = false) {
    return await this.find(null, raw)
  }

  async save(model) {
    try {
      if (model.id) {
        return await this.__update(model)
      } else {
        return await this.__create(model)
      }
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === HttpStatus.BAD_REQUEST) {
          // server will send over a validation error object in data
          throw new ValidationError('property validation failed', error, error.data)
        }
        if (error.status === HttpStatus.NOT_FOUND) {
          throw new NotFoundError('property not found', error)
        }
        if (error.status === HttpStatus.UNAUTHORIZED) {
          throw new AuthorizationError('unauthorized', error)
        }
      }
      const saveMethod = model.id ? 'updating' : 'creating'
      throw error.wrap(`unknown error ${saveMethod} ${this.modelClass.name}`)
    }
  }

  async __create(model) {
    const response = await http.post(this.endpoint, model)
    return new this.modelClass(response.data, this)
  }

  async __update(model) {
    const response = await http.patch(`${this.endpoint}/${model.id}`, model)
    return new this.modelClass(response.data, this)
  }
}

export default HttpRepository
