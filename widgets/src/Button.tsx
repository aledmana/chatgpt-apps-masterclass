export default function Button({ label, disabled }: { label: string, disabled: boolean }) {
    return <button disabled={disabled}>{label}</button>;
}