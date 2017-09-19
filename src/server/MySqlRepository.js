import { mysql } from '@jeffreznik/utils/server'
import { GeneralError } from '@jeffreznik/error'

class MySqlRepository {
  constructor(modelClass, tableName) {
    this.modelClass = modelClass
    this.tableName = tableName
  }

  async find(attributes, raw = false) {
    const sql = `select * from ${this.tableName} where ${this.__filterAttributes(attributes).join(' and ')}`
    try {
      const db = await mysql.getConnection()
      const [results] = await db.query(sql, attributes)
      return results.map(row => {
        for (const attr in row) {
          if (this.modelClass.defaultAttributes[attr] !== null && typeof this.modelClass.defaultAttributes[attr] === 'object') {
            row[attr] = JSON.parse(row[attr])
          }
        }
        if (raw)
          return row
        else
          return new this.modelClass(row, this)
      })
    } catch (error) {
      throw new GeneralError(`failed querying ${this.modelClass.name}`, error)
    }
  }

  async findOne(attributes, raw = false) {
    const results = await this.find(attributes, raw)
    if (results.length) {
      return results[0]
    } else {
      return false
    }
  }

  async findById(id, raw = false) {
    return await this.findOne({id}, raw)
  }

  __filterAttributes(attributes) {
    const filtered = []
    for (const key in attributes) {
      if (this.modelClass.attributeNames.indexOf(key) !== -1)
        filtered.push(`${key}=:${key}`)
    }
    return filtered
  }

  async save(model) {
    try {
      if (model.id) {
        await this.__update(model)
      } else {
        model.id = await this.__insert(model) // mutating model here - maybe not the best idea
      }
      return model
    } catch (error) {
      const saveMethod = model.id ? 'updating' : 'inserting'
      throw new GeneralError(`failed ${saveMethod} ${this.modelClass.name}`, error)
    }
  }

  async delete(attributes) {
    const filteredAttributes = this.__filterAttributes(attributes);
    if (!filteredAttributes) {
      return false
    }

    const sql = `delete from ${this.tableName} where ${filteredAttributes.join(' and ')}`
    try {
      const db = await mysql.getConnection()
      return await db.query(sql, attributes)
    } catch (error) {
      throw new GeneralError(`failed deleting ${this.modelClass.name}`, error)
    }
  }

  async __insert(model) {
    const namedParameters = this.modelClass.writableAttributes.map(attr => ':' + attr)
    const sql = `insert into ${this.tableName}
      (${this.modelClass.writableAttributes.join()}) values
      (${namedParameters.join()})`

    const db = await mysql.getConnection()
    const [result] = await db.query(sql, this.__convertValues(model))
    return result.insertId
  }

  async __update(model) {
    const updateFields = this.modelClass.writableAttributes.map(attr => `${attr}=:${attr}`)
    const sql = `update ${this.tableName} set ${updateFields.join()} where id=:id`

    const db = await mysql.getConnection()
    const [result] = await db.query(sql, this.__convertValues(model))
    return result.affectedRows
  }

  __convertValues(model) {
    const values = {}
    for (const attr in model) {
      if (model[attr] !== null && typeof model[attr] === 'object')
        values[attr] = JSON.stringify(model[attr])
      else
        values[attr] = model[attr]
    }
    return values
  }
}

export default MySqlRepository
