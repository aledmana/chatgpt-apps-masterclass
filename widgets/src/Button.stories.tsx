import type { Story } from "@ladle/react";
import Button from "./Button";

export const ButtonStory: Story<{label:string, disabled:boolean}> = ({label, disabled}) => (
    <Button label={label} disabled={disabled} />
);

ButtonStory.args = {
    label: "Hello world!!!",
    disabled: false,
};