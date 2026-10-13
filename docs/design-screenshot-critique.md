# Design screenshot critique workflow

Use screenshots to evaluate the rendered product, not its implementation.

## General guidance

### Capture

- Capture on the target mobile platform and device class.
- Capture the complete screen first. Keep the original capture unchanged.
- Wait for navigation, layout, and animations to settle before capturing.
- Capture enough of the flow to judge the design as a system.

Store working captures in the directory:

```text
docs/.screenshots/<design-name>/
```

#### Storage

Use stable, descriptive names:

```text
docs/.screenshots/<design-name>/
  00-welcome.png
```

The screenshot directory is ignored by git.

### Critic

- Start every critique in a fresh context.
- Use the same critic prompt for every round.
- Mention screenshot paths and instruct the critic to open/read them
  independently. Do not provide source code, implementation details, or prior
  critique.
- Ask for high-level composition and fine-detail review, including hierarchy,
  rhythm, spacing, typography, color, alignment, radii, separators, and control
  states.
- Ask the critic to identify excessive, overdone, stock, or obviously
  AI-generated patterns and penalize them.
- Ask whether the result reads as native mobile rather than web, including
  sensible use of native controls and liquid glass.
- Require tight, specific, bold feedback, ranked fixes, and one score out of 10.
- Count a critique as successful only when the response clearly references
  visible details in the screenshots and includes the requested score. File
  discovery alone is not visual review. If the tool hangs or cannot inspect
  the images, report that failure rather than inventing feedback.

Do not use `@<path>` attachments unless attachment behavior has been verified
in the current environment. Independent file reads and image attachments are
different mechanisms.

### Iteration

Apply only feedback grounded in visible screenshots. Recapture the same set
with the same device and framing, then run the same prompt again. Continue
until the critic independently scores the rendered design at 9/10 or higher
or latest after 3 rounds unless you've explicitly been told something else.

The current critic prompt must mention the repository-relative paths
above and tell the subagent to open them independently. If it can't read them,
it must not make any judgement.
