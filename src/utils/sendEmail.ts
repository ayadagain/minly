import { resend } from '../lib'

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
        console.error(error)
    }
}

export default sendEmail