from apps.extraction.validation import validate_pay_stub, validate_w2

GOOD_W2 = {
    "employee_ssn": "900-12-6789",
    "employer_ein": "12-3456789",
    "employer_name": "Acme Corp",
    "employee_name": "Jane Sample",
    "box1_wages": "85,000.00",
    "box2_federal_tax": "12,410.00",
    "box3_ss_wages": "85,000.00",
    "box4_ss_tax": "5,270.00",
    "box5_medicare_wages": "85,000.00",
    "box6_medicare_tax": "1,232.50",
}


def test_valid_w2_has_no_issues():
    assert validate_w2(GOOD_W2, 2026) == {}


def test_box4_must_be_6_2_percent_of_box3():
    issues = validate_w2(GOOD_W2 | {"box4_ss_tax": "5,720.00"}, 2026)
    assert issues == {"box4_ss_tax": "Box 4 should be 6.2% of Box 3 (expected 5,270.00)."}


def test_additional_medicare_tax_above_200k():
    w2 = GOOD_W2 | {
        "box1_wages": "250,000.00", "box3_ss_wages": "184,500.00", "box4_ss_tax": "11,439.00",
        "box5_medicare_wages": "250,000.00", "box6_medicare_tax": "4,075.00",
    }  # fmt: skip
    assert validate_w2(w2, 2026) == {}


def test_formats_and_wage_base():
    issues = validate_w2(
        GOOD_W2 | {"employee_ssn": "900126789", "employer_ein": "123", "box3_ss_wages": "200,000"}, 2026
    )
    assert set(issues) >= {"employee_ssn", "employer_ein", "box3_ss_wages"}


def test_unparseable_money_is_flagged():
    assert "box1_wages" in validate_w2(GOOD_W2 | {"box1_wages": "8S,000"}, 2026)


def test_pay_stub_rules():
    stub = {
        "gross_pay": "3,000",
        "federal_tax": "300",
        "net_pay": "3,100",
        "ytd_gross": "2,000",
        "ytd_federal_tax": "600",
    }
    assert set(validate_pay_stub(stub, 2026)) == {"net_pay", "ytd_gross"}
