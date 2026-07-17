import re
valid_uid_pattern = re.compile(r'^U[0-9a-fA-F]{32}$')
uids = ['U3faf9f288a68ba1d60bec86ab30e6720', 'U985cc636c265b34f0ae10ed860622a72', 'Uac985f5f90b35f1c4ca6077eae6053e4', 'Ua4e280312af5df328512987d8e73d167', 'U6994437f46e7a48c36dabd853323545e']
print([valid_uid_pattern.match(uid) is not None for uid in uids])
