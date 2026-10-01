/**
 * Whether the key was pressed into something that is typed in: a field
 * answers its own keys, and the page keeps its hands off them.
 */
export function typingIn(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  const tag = element?.tagName;
  return (
    element?.isContentEditable === true || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
  );
}
