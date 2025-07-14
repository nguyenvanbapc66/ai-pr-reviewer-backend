import app from './app';
import { config } from './config';
import { logMemoryUsage, monitorMemoryUsage } from './utils';

// Start memory monitoring in development
if (config.nodeEnv === 'development') {
  logMemoryUsage('Server Startup');
  monitorMemoryUsage(60000); // Check every minute in development
}

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  logMemoryUsage('Server Started');
});
