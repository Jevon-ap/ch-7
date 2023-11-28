const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer')
const prisma = new PrismaClient()

const register = async (req, res, next) => {
  const { email, password } = req.body
  const hashedPassword = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  })
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' })
  res.status(201).json({ message: 'User registered', user, token })
}

const login = async (req, res, next) => {
  const { email, password } = req.body
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  })
  if (!user) {
    return res.status(401).json({ message: 'Authentication failed' })
  }
  const match = await bcrypt.compare(password, user.password)
  if (!match) {
    return res.status(401).json({ message: 'Authentication failed' })
  }
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' })
  res.json({ message: 'Authentication successful', token })
}

const forgotPassword = async (req, res, next) => {
  const { email } = req.body
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(200).json({ message: 'If a user with that email exists, we have sent a reset link to your email.' })
  }
  const resetToken = (Math.random() + 1).toString(36).substring(7)
  const hashedResetToken = await bcrypt.hash(resetToken, 10)
  const resetTokenExpiration = new Date(Date.now() + 3600000)
  await prisma.user.update({
    where: { email },
    data: {
      resetToken: hashedResetToken,
      resetTokenExpiration,
    },
  })
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  })
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: process.env.EMAIL_USERNAME,
    subject: 'Password Reset',
    text: `Your password reset token is: ${resetToken}`,
  }
  await transporter.sendMail(mailOptions)
  res.status(200).json({ message: 'we have sent a reset link to your email.' })
}

const resetPassword = async (req, res, next) => {
  const { email, token, newPassword } = req.body
  const user = await prisma.user.findUnique({
    where: { email },
  })
  if (!user || !user.resetTokenExpiration || user.resetTokenExpiration < new Date()) {
    return res.status(400).json({ message: 'Invalid or expired password reset token.' })
  }
  const tokenMatches = await bcrypt.compare(token, user.resetToken)
  if (!tokenMatches) {
    return res.status(400).json({ message: 'Invalid or expired password reset token.' })
  }
  const hashedNewPassword = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { email },
    data: {
      password: hashedNewPassword,
      resetToken: null,
      resetTokenExpiration: null,
    },
  })
  res.status(200).json({ message: 'Your password has been successfully reset.' })
}

module.exports = { 
  register,
  login,
  forgotPassword,
  resetPassword
}