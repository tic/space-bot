import { config } from '../config';
import { logMessage } from '../services/logger.service';
import { app } from '../services/webserver.service';

app.listen(config.web.port, () => {
  logMessage('service.webserver.initialize', 'Web server is listening for requests.');
});
