import { Request } from 'express'
import { UserData } from '../types'

interface CustomRequest extends Request {
    user?: UserData
}

export default CustomRequest;