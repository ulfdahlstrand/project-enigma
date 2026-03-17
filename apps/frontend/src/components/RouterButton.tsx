import { createLink } from "@tanstack/react-router";
import Button from "@mui/material/Button";

/**
 * A MUI Button that integrates with TanStack Router for type-safe navigation.
 * Use instead of `<Button component={Link} to="..." ...>`.
 *
 * @example
 * <RouterButton variant="contained" to="/assignments/new" search={{ employeeId }}>
 *   New Assignment
 * </RouterButton>
 */
const RouterButton = createLink(Button);

export default RouterButton;
