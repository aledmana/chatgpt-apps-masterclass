import { Alert } from "@openai/apps-sdk-ui/components/Alert";
import { Button } from "@openai/apps-sdk-ui/components/Button";

function App() {
  return (
    <Alert
      actions={
        <Button color="primary" pill variant="soft">
          Dismiss
        </Button>
      }
      description="We'll be offline 2 - 4 AM UTC on July 14 while we upgrade our database."
      title="Scheduled maintenance"
    />
  );
}

export default App
