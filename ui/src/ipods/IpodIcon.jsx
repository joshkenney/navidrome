import React from 'react'

// Classic iPod silhouette: body, screen and click wheel. Uses currentColor like react-icons
export const IpodIcon = ({ size = 20, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
    {...props}
  >
    <rect x="5" y="1.5" width="14" height="21" rx="2.5" />
    <rect x="7.5" y="4" width="9" height="6.5" rx="0.8" />
    <circle cx="12" cy="16.5" r="3.6" />
    <circle cx="12" cy="16.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)
