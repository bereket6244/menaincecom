# Digital Invite Package Cards QA

Source visual: user-provided four-card pricing reference.

Prototype checked: `http://localhost:5173/digital-invitations`

Checks:
- Four cards render with the same package names, descriptions, prices, and feature content as the reference.
- Standard is highlighted with a pink border, light pink card tint, and `Most Popular` badge.
- Basic, Standard, Premium, and Ultimate use leaf, heart, diamond, and crown icon treatments matching the reference structure.
- Desktop layout is responsive: two columns at the current app width and four columns at wider breakpoints.
- Mobile layout stacks cards cleanly with no text overlap.
- Ordering remains available from each card through a compact native reveal control.

Final result: passed
