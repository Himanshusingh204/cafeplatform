# ADMIN_GUIDE.md

## Access

`/admin/login`. First admin is created via the secure setup script (`scripts/create-admin.mjs`), which reads credentials from env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) — never from source code.

## Dashboard

Overview cards: total dishes, active categories, featured items, new messages. Recent activity + quick actions.

## Menu

### Categories
Create (name → auto slug), reorder, activate/deactivate, delete (soft). Deleting a category with dishes is blocked or moves dishes — confirm first.

### Dishes
- Create: name, category, price, short description, full description, image, dietary tags, availability, featured, sort order.
- Edit: all fields.
- Publish/unpublish: `isAvailable` toggles visibility on the public menu.
- Feature: toggle `isFeatured` (appears on homepage).
- Delete: confirmation modal → soft delete (recoverable). Hard delete requires the SUPER_ADMIN confirmation flow.
- Search/filter/sort and pagination for large menus.

## Gallery

Upload images (validated: image types only, ≤5MB), set title + alt text, choose category, set sort order, publish/unpublish, delete with confirmation.

## Messages

Inbox of contact submissions. Status workflow: NEW → READ → REPLIED → ARCHIVED. Reply info (phone/email) shown next to each message.

## Settings

Edit business info: café name, tagline, phone, email, address, maps link, opening hours, Instagram/Facebook/WhatsApp, reservation link. These feed the public site — one place, everywhere.

## Activity

Read-only audit trail of admin actions (login, create/edit/delete, publish, settings changes) with actor and timestamp.

## Security Notes

- Sessions expire automatically; you'll be re-prompted to log in.
- Destructive actions always ask for confirmation.
- Log out on shared devices.