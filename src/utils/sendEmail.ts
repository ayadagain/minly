import exp from 'constants'
import {Resend} from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const sendEmail = async (to: string, subject: string, text: string) => {
    try {
        const response = await resend.emails.send({
            from: 'no-reply@mailing.ayad.xyz',
            to,
            subject,
            text
        })
        console.log(response)
    } catch (error) {
        console.log(error)
    }
}

export default sendEmail