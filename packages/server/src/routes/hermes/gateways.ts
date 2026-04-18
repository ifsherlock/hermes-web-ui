import Router from '@koa/router'

export const gatewayRoutes = new Router()

// Get singleton instance — set during bootstrap
let manager: any = null

export function setGatewayManager(mgr: any) {
  manager = mgr
}

export function getGatewayManager(): any {
  return manager
}

// List all gateway statuses
gatewayRoutes.get('/api/hermes/gateways', async (ctx) => {
  if (!manager) {
    ctx.status = 503
    ctx.body = { error: 'GatewayManager not initialized' }
    return
  }
  const gateways = await manager.listAll()
  ctx.body = { gateways }
})

// Start a profile's gateway
gatewayRoutes.post('/api/hermes/gateways/:name/start', async (ctx) => {
  if (!manager) {
    ctx.status = 503
    ctx.body = { error: 'GatewayManager not initialized' }
    return
  }
  const { name } = ctx.params
  try {
    const status = await manager.start(name)
    ctx.body = { success: true, gateway: status }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// Stop a profile's gateway
gatewayRoutes.post('/api/hermes/gateways/:name/stop', async (ctx) => {
  if (!manager) {
    ctx.status = 503
    ctx.body = { error: 'GatewayManager not initialized' }
    return
  }
  const { name } = ctx.params
  try {
    await manager.stop(name)
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// Check a profile's gateway health
gatewayRoutes.get('/api/hermes/gateways/:name/health', async (ctx) => {
  if (!manager) {
    ctx.status = 503
    ctx.body = { error: 'GatewayManager not initialized' }
    return
  }
  const { name } = ctx.params
  const status = await manager.detectStatus(name)
  ctx.body = { gateway: status }
})
