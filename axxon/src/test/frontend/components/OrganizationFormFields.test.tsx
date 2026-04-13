// Verifies the organization accent picker supports both curated swatches and custom color overrides.
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import OrganizationFormFields from '@/components/features/dashboard/OrganizationFormFields';

function OrganizationFormFieldsHarness() {
  const [name, setName] = useState('Platform');
  const [description, setDescription] = useState('Core delivery org');
  const [color, setColor] = useState('#6366f1');

  return (
    <OrganizationFormFields
      name={name}
      description={description}
      color={color}
      onNameChange={setName}
      onDescriptionChange={setDescription}
      onColorChange={setColor}
    />
  );
}

describe('OrganizationFormFields', () => {
  it('updates the preview from swatches and custom color input', () => {
    const { container } = render(<OrganizationFormFieldsHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Use accent #0891b2' }));
    expect(screen.getAllByText('#0891B2')).not.toHaveLength(0);

    const customColorInput = container.querySelector('input[type="color"]');

    expect(customColorInput).not.toBeNull();

    fireEvent.change(customColorInput as HTMLInputElement, {
      target: { value: '#dc2626' },
    });

    expect(screen.getAllByText('#DC2626')).not.toHaveLength(0);
  });
});
