import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { Field, FieldError, FieldLabel } from './field.tsx';
import { Input } from './input.tsx';

const meta = {
  component: Input,
  title: 'Input',
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLabel: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText('Email');
    await userEvent.type(input, 'mert@example.com');
    await expect(input).toHaveValue('mert@example.com');
  },
  render: () => (
    <Field>
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <Input id="email" name="email" type="email" />
    </Field>
  ),
};

export const WithError: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    await expect(canvas.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  },
  render: () => (
    <Field data-invalid>
      <FieldLabel htmlFor="email-error">Email</FieldLabel>
      <Input aria-invalid defaultValue="not-an-email" id="email-error" name="email" type="email" />
      <FieldError role="alert">Enter a valid email address.</FieldError>
    </Field>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, placeholder: 'Disabled' },
};
