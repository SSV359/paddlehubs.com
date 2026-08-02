/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

// The Court Energy theme's single signature element — a literal
// pickleball net rendered as a dashed divider. Used deliberately, not
// scattered everywhere: one per hero/banner section, right below the
// title block.
export const NetDivider: React.FC<{ light?: boolean; className?: string }> = ({ light, className = '' }) => (
  <div className={`net-divider ${light ? 'on-light' : ''} ${className}`} />
);
