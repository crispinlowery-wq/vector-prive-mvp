import zipfile

from app.services.linkedin_contacts import read_linkedin_connections


def test_reads_only_valid_deduplicated_linkedin_contacts(tmp_path):
    export = tmp_path / "linkedin.zip"
    payload = """Notes:\nExport notice\n\nFirst Name,Last Name,URL,Email Address,Company,Position,Connected On\nAda,Lovelace,https://www.linkedin.com/in/ada,private@example.com,Analytical Engines,Founder,26 Aug 2026\nAda,Lovelace,https://www.linkedin.com/in/ada,changed@example.com,Vector,Advisor,27 Aug 2026\nNo,Profile,,hidden@example.com,Secret,Role,27 Aug 2026\n"""
    with zipfile.ZipFile(export, "w") as archive:
        archive.writestr("Connections.csv", payload)

    contacts = read_linkedin_connections(export)

    assert len(contacts) == 1
    assert contacts[0].full_name == "Ada Lovelace"
    assert contacts[0].company == "Vector"
    assert not hasattr(contacts[0], "email")
