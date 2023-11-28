require('dotenv').config()
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const authRoutes = require('./src/routes/authRoute')
const Sentry = require('@sentry/node')
const { ProfilingIntegration } = require("@sentry/profiling-node")

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/api/auth', authRoutes)

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Sentry.Integrations.Express({ app }),
    new ProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0,
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
})

app.use(Sentry.Handlers.requestHandler())

// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler())

// All your controllers should live here
app.get("/", function rootHandler(req, res) {
  res.end("Hello world!")
})

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler())

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500
  res.end(res.sentry + "\n")
})

io.on('connection', (socket) => {
  console.log('a user connected :' ,socket.id)

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
  })
})

const port = process.env.PORT || 8080

app.get('/debug-sentry', function mainHandler(req, res) {
  throw new Error('Testing Sentry error handling!')
})

server.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})


