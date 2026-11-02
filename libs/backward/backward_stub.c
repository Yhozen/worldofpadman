/* Local stub (WoP web port experiments): used when building without a C++ toolchain. */
#include "backward_c.h"
int backward_init_signal_handlers(void) { return 0; }
void backward_shutdown_signal_handlers(void) {}
void backward_print_stacktrace(FILE *fp) { (void)fp; }
void backward_print_stacktrace_from_addr(void *addr, FILE *fp) { (void)addr; (void)fp; }
void backward_add_source_prefix(const char *prefix) { (void)prefix; }
